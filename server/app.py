import os
import re
import ast
import time
import zipfile
import tempfile
import logging
import google.generativeai as genai
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from io import BytesIO
from jose import jwt
import requests
from pymongo import MongoClient
from bson import ObjectId
from flask_cors import CORS

# Load environment variables
load_dotenv()

# Configure logging first
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('README-Generator')

JWKS_URL = os.getenv("CLERK_JWKS_URL")

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["readme_generator_db"]

readmes_collection = db["readmes"]
usage_collection = db["usage"]
user_collection = db["user"]

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
MAX_TOKENS = 200000  # Conservative buffer (250k TPM / 10 RPM)
RPM_DELAY = 6.5  # 10 requests/minute = 1 per 6 seconds
SUPPORTED_EXTENSIONS = {'.py', '.js', '.ts', '.java', '.go', '.rs', '.php', '.jsx', '.tsx'}

IGNORE_PATTERNS = [
    r'node_modules/.*', r'__pycache__/.*', r'\.git/.*', 
    # Python virtual environments - catch ALL venv variations
    r'\.?venv.*/.*',  # Matches venv, .venv, venv310, venv50, venvXXX, etc.
    r'\.?env.*/.*',   # Matches env, .env, env310, env50, envXXX, etc.
    r'virtualenv/.*', r'\.virtualenv/.*', r'pyenv/.*', r'\.pyenv/.*',
    # Common build/cache directories
    r'vendor/.*', r'target/.*', r'dist/.*', r'build/.*',
    # Binary and media files
    r'.*\.(png|jpg|jpeg|gif|bmp|ico|svg|log|bin|dll|exe|DS_Store|pdf|zip|tar|gz|pyc|pyd|so)',
    # Python-specific directories
    r'.*\.egg-info/.*', r'__pycache__', r'\.pytest_cache/.*',
    # IDE files
    r'\.idea/.*', r'\.vscode/.*', r'\.vs/.*',
    # Package manager files
    r'package-lock\.json', r'yarn\.lock', r'Pipfile\.lock',
    # Other cache directories
    r'\.mypy_cache/.*', r'\.coverage/.*', r'htmlcov/.*',
]

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_INDIVIDUAL_FILE_SIZE = 10 * 1024 * 1024  # 5 MB per file


def get_user_id_from_request(req):
    """Extract and validate user ID from JWT token"""
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]

    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")

        jwks = requests.get(JWKS_URL, timeout=10).json()
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)

        if not key:
            logger.warning("No matching JWKS key found.")
            return None

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )

        return payload.get("sub")

    except Exception as e:
        logger.error(f"JWT decode error: {e}")
        return None


def safe_extract_zip(zip_path, extract_dir):
    """Safely extract ZIP file with protection against path traversal"""
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        for member in zip_ref.infolist():
            # Check for path traversal
            if os.path.isabs(member.filename) or ".." in member.filename:
                logger.warning(f"Skipping potentially unsafe file: {member.filename}")
                continue
            
            # Check for extremely large files
            if member.file_size > MAX_INDIVIDUAL_FILE_SIZE:
                logger.warning(f"Skipping large file: {member.filename} ({member.file_size} bytes)")
                continue
                
            zip_ref.extract(member, extract_dir)


def validate_zip_file(file_obj):
    """Validate that the uploaded file is a proper ZIP file"""
    try:
        with zipfile.ZipFile(file_obj, 'r') as zip_ref:
            # Test the ZIP file integrity
            bad_file = zip_ref.testzip()
            if bad_file:
                return False, f"Corrupted file in ZIP: {bad_file}"
            
            # Check for ZIP bomb (too many files)
            if len(zip_ref.infolist()) > 100000:
                return False, "ZIP contains too many files (max 10,000)"
                
            return True, "Valid ZIP file"
    except zipfile.BadZipFile:
        return False, "Invalid ZIP file"
    except Exception as e:
        return False, f"ZIP validation error: {str(e)}"


class ProjectProcessor:
    def __init__(self, project_dir, api_key, user_prompt, model_name):
        self.project_dir = project_dir  # Fixed: Added missing assignment
        self.api_key = api_key
        self.user_prompt = user_prompt
        self.model_name = model_name
        self.readme_sections = []
        self.folder_structure = self.get_folder_structure()
        self.token_count = 0

    def should_ignore(self, path):
        """Check if a path matches any ignore patterns (normalized for OS-agnostic paths)"""
        try:
            rel_path = os.path.relpath(path, self.project_dir).replace("\\", "/")
        except ValueError:
            # Handle cases where path is not relative to project_dir
            return True
            
        for pattern in IGNORE_PATTERNS:
            if re.fullmatch(pattern, rel_path) or re.search(pattern, rel_path):
                return True
        return False

    def get_folder_structure(self):
        """Generate tree-like folder structure string with improved formatting"""
        structure = []
        
        # Get all directories and files first
        all_items = []
        for root, dirs, files in os.walk(self.project_dir):
            if self.should_ignore(root):
                continue
                
            # Sort directories and files alphabetically
            dirs.sort()
            files.sort()
            
            level = len(os.path.relpath(root, self.project_dir).split(os.sep)) - 1
            if root == self.project_dir:
                level = 0
                
            # Add directory
            if level == 0:
                structure.append(f"{os.path.basename(self.project_dir)}/")
            else:
                indent = "│   " * (level - 1) + "├── "
                structure.append(f"{indent}{os.path.basename(root)}/")
            
            # Add files in this directory
            for f in files:
                file_path = os.path.join(root, f)
                if not self.should_ignore(file_path):
                    file_indent = "│   " * level + "├── "
                    structure.append(f"{file_indent}{f}")
                    
        return "\n".join(structure)

    def estimate_tokens(self, text):
        """More accurate token estimation for Gemini (approximately 1 token per 3.5 characters)"""
        if not text:
            return 0
        return max(1, len(text.strip()) // 4)

    def chunk_python(self, content):
        """Improved AST-based chunking for Python with better error handling"""
        chunks = []
        try:
            tree = ast.parse(content)
            for node in tree.body:
                if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
                    chunk = ast.get_source_segment(content, node)
                    if chunk:
                        node_type = 'function' if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) else 'class'
                        chunks.append({
                            'type': node_type,
                            'name': node.name,
                            'code': chunk,
                            'tokens': self.estimate_tokens(chunk)
                        })
        except SyntaxError as e:
            logger.warning(f"Python syntax error, falling back to regex chunking: {e}")
            return self.chunk_by_regex(content, r'((?:def|class|async def)\s+\w+.*?)(?=\n(?:def|class|async def)\s|\Z)', 'python_block')
        except Exception as e:
            logger.error(f"Error parsing Python file: {e}")
            return []
        return chunks

    def chunk_javascript(self, content):
        """Improved JavaScript/TypeScript chunking with better patterns"""
        patterns = [
            # Functions
            r'(function\s+\w+\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\})',
            # Arrow functions with blocks
            r'(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})',
            r'(let\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})',
            r'(var\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})',
            # Classes
            r'(class\s+\w+\s*(?:extends\s+\w+)?\s*\{(?:[^{}]|\{[^{}]*\})*\})',
            # Object methods
            r'(\w+\s*:\s*function\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\})',
        ]
        
        chunks = []
        for pattern in patterns:
            for match in re.finditer(pattern, content, re.DOTALL):
                chunk = match.group(1).strip()
                if chunk and len(chunk) > 20:  # Skip very small chunks
                    chunks.append({
                        'type': 'function',
                        'name': f"js_block_{len(chunks)}",
                        'code': chunk,
                        'tokens': self.estimate_tokens(chunk)
                    })
        
        # If no patterns matched, fall back to generic chunking
        if not chunks:
            return self.chunk_by_regex(content, r'(\{[^{}]*\})', 'js_block')
        
        return chunks

    def chunk_java(self, content):
        """Improved Java chunking"""
        # Match classes, interfaces, enums with proper brace matching
        pattern = r'((?:public|private|protected)?\s*(?:static)?\s*(?:class|interface|enum)\s+\w+(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{)'
        
        chunks = []
        matches = list(re.finditer(pattern, content))
        
        for i, match in enumerate(matches):
            start = match.start()
            # Find the matching closing brace
            brace_count = 0
            pos = match.end() - 1  # Start from the opening brace
            
            while pos < len(content):
                if content[pos] == '{':
                    brace_count += 1
                elif content[pos] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        break
                pos += 1
            
            if brace_count == 0:
                chunk = content[start:pos + 1]
                chunks.append({
                    'type': 'class',
                    'name': f"java_class_{i}",
                    'code': chunk,
                    'tokens': self.estimate_tokens(chunk)
                })
        
        return chunks

    def chunk_by_regex(self, content, pattern, default_name='block'):
        """Generic regex-based chunking with improved error handling"""
        chunks = []
        try:
            for i, match in enumerate(re.finditer(pattern, content, re.DOTALL)):
                chunk = match.group(1).strip()
                if chunk and len(chunk) > 10:  # Skip very small chunks
                    chunks.append({
                        'type': 'block',
                        'name': f"{default_name}_{i}",
                        'code': chunk,
                        'tokens': self.estimate_tokens(chunk)
                    })
        except Exception as e:
            logger.error(f"Regex chunking error: {e}")
        
        return chunks

    def process_file(self, file_path):
        """Process file with improved error handling and size checks"""
        try:
            # Check file size before reading
            file_size = os.path.getsize(file_path)
            if file_size > MAX_INDIVIDUAL_FILE_SIZE:
                logger.info(f"Skipping large file: {file_path} ({file_size} bytes)")
                return []
            
            if file_size == 0:
                logger.debug(f"Skipping empty file: {file_path}")
                return []
        except OSError as e:
            logger.error(f"Error checking file size {file_path}: {e}")
            return []
        
        rel_path = os.path.relpath(file_path, self.project_dir)
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Error reading {file_path}: {str(e)}")
            return []
        
        if not content.strip():
            return []
        
        _, ext = os.path.splitext(file_path)
        chunks = []
        
        try:
            if ext == '.py':
                chunks = self.chunk_python(content)
            elif ext in ('.js', '.ts', '.jsx', '.tsx'):
                chunks = self.chunk_javascript(content)
            elif ext == '.java':
                chunks = self.chunk_java(content)
            else:
                # Generic chunking for other languages
                chunks = [{
                    'type': 'file',
                    'name': os.path.basename(file_path),
                    'code': content,
                    'tokens': self.estimate_tokens(content)
                }]
        except Exception as e:
            logger.error(f"Error chunking file {file_path}: {e}")
            # Fallback to treating entire file as one chunk
            chunks = [{
                'type': 'file',
                'name': os.path.basename(file_path),
                'code': content,
                'tokens': self.estimate_tokens(content)
            }]
        
        # If file is too big and couldn't be chunked effectively, split by lines
        if len(chunks) == 1 and chunks[0]['tokens'] > MAX_TOKENS // 2:
            lines = content.split('\n')
            chunk_size = min(300, len(lines) // 4)  # Adaptive chunk size
            chunks = []
            
            for i in range(0, len(lines), chunk_size):
                chunk_content = '\n'.join(lines[i:i+chunk_size])
                if chunk_content.strip():
                    chunks.append({
                        'type': 'partial',
                        'name': f"{os.path.basename(file_path)}_part{i//chunk_size + 1}",
                        'code': chunk_content,
                        'tokens': self.estimate_tokens(chunk_content)
                    })
        
        # Add file path to all chunks
        for chunk in chunks:
            chunk['path'] = rel_path
            
        return chunks

    def generate_section(self, batch):
        """Generate README section using Gemini API with improved error handling"""
        try:
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model_name)
            
            context = "\n\n".join(
                f"// File: {item['path']}\n// Type: {item['type']}\n// Name: {item['name']}\n{item['code']}" 
                for item in batch
            )
            
            prompt = f"""
Generate comprehensive README documentation for these code components.
User requirements: {self.user_prompt}

Project structure:
{self.folder_structure}

Code components:
{context}

Focus on:
- Purpose and functionality
- Key features and components
- Parameters and return values (for functions)
- Usage examples where applicable
- Dependencies and requirements
- Important implementation details

Output ONLY Markdown content without section headers like # or ##.
Be concise but comprehensive.
"""
            
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
            else:
                logger.error("Empty response from Gemini API")
                return "*[Section generation returned empty response]*"
                
        except Exception as e:
            logger.error(f"API Error in generate_section: {str(e)}")
            return f"*[Section generation failed: {str(e)}]*"

    def bin_packing_best_fit(self, items, bin_capacity):
        """Improved best-fit decreasing bin packing algorithm"""
        # Sort items by token count in descending order
        items.sort(key=lambda x: x['tokens'], reverse=True)
        bins = []
        
        for item in items:
            if item['tokens'] > bin_capacity:
                logger.warning(f"Item {item['name']} ({item['tokens']} tokens) exceeds bin capacity")
                # Split large items if possible
                continue
                
            # Find the best-fit bin (smallest remaining capacity that can fit the item)
            best_bin = None
            best_fit = float('inf')
            
            for bin_info in bins:
                remaining = bin_info['remaining']
                if remaining >= item['tokens'] and remaining < best_fit:
                    best_bin = bin_info
                    best_fit = remaining
            
            if best_bin:
                best_bin['items'].append(item)
                best_bin['remaining'] -= item['tokens']
            else:
                # Create new bin
                bins.append({
                    'items': [item],
                    'remaining': bin_capacity - item['tokens']
                })
        
        return [bin_info['items'] for bin_info in bins if bin_info['items']]

    def process(self):
        """Main processing pipeline with improved error handling"""
        all_chunks = []

        try:
            for root, dirs, files in os.walk(self.project_dir):
                # Filter out ignored directories in-place
                dirs[:] = [d for d in dirs if not self.should_ignore(os.path.join(root, d))]

                for file in files:
                    file_path = os.path.join(root, file)
                    ext = os.path.splitext(file)[1].lower()

                    if self.should_ignore(file_path):
                        logger.debug(f"Skipping ignored file: {file_path}")
                        continue

                    if ext not in SUPPORTED_EXTENSIONS:
                        logger.debug(f"Skipping unsupported file: {file_path}")
                        continue

                    chunks = self.process_file(file_path)
                    if chunks:
                        all_chunks.extend(chunks)
                        logger.info(f"Processed {file_path} ({len(chunks)} chunks)")

            if not all_chunks:
                raise ValueError("No supported code files found in the project")
            
            self.token_count = sum(chunk['tokens'] for chunk in all_chunks)
            logger.info(f"Total estimated tokens: {self.token_count}")

            # Use improved bin packing
            batches = self.bin_packing_best_fit(all_chunks, MAX_TOKENS)
            logger.info(f"Created {len(batches)} batches for processing")

            for i, batch in enumerate(batches):
                batch_tokens = sum(item['tokens'] for item in batch)
                logger.info(f"Processing batch {i+1}/{len(batches)} ({batch_tokens} tokens, {len(batch)} items)")
                
                section = self.generate_section(batch)
                if section and section.strip():
                    self.readme_sections.append(section)
                
                # Rate limiting
                if i < len(batches) - 1:
                    time.sleep(RPM_DELAY)

            return self.generate_final_readme()
            
        except Exception as e:
            logger.error(f"Error in process(): {e}")
            raise

    def generate_final_readme(self):
        """Combine sections into final README with improved structure"""
        if not self.readme_sections:
            logger.warning("No sections generated, creating basic README")
            return f"""# Project README

## Overview
This project was automatically analyzed but no detailed sections could be generated.

## Project Structure
```
{self.folder_structure}
```

## Getting Started
Please refer to the project files for more information.
"""

        combined_sections = "\n\n---\n\n".join(self.readme_sections)
        
        prompt = f"""
Create a comprehensive, professional README.md from these analyzed sections:

{combined_sections}

User requirements: {self.user_prompt}

Project structure:
{self.folder_structure}

Structure the README with these sections:
1. # Project Title and Brief Description
2. ## Table of Contents
3. ## Overview/About
4. ## Features
5. ## Installation
6. ## Usage
7. ## Configuration (if applicable)
8. ## API Documentation (if applicable)
9. ## Project Structure
10. ## Contributing
11. ## License

Guidelines:
- Use proper Markdown formatting
- Include code examples where relevant
- Be comprehensive but concise
- Ensure all sections flow logically
- Use the project structure provided
- Make it professional and user-friendly
"""
        
        try:
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model_name)
            response = model.generate_content(prompt)
            
            if response and response.text:
                logger.info("Final README generated successfully")
                return response.text.strip()
            else:
                logger.error("Empty response for final README generation")
                # Fallback
                return self.create_fallback_readme(combined_sections)
                
        except Exception as e:
            logger.error(f"Final assembly failed: {str(e)}")
            return self.create_fallback_readme(combined_sections)

    def create_fallback_readme(self, combined_sections):
        """Create a fallback README when API calls fail"""
        return f"""# Project README

## Overview
{self.user_prompt}

## Project Structure
```
{self.folder_structure}
```

## Documentation

{combined_sections}

## Installation
Please refer to the project files for installation instructions.

## Usage
Please refer to the project files for usage instructions.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
Please check the project files for license information.
"""


@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "README Generator API v1.0", "status": "running"}), 200


@app.route('/readmes', methods=['GET'])
def list_readmes():
    """List all READMEs for the authenticated user"""
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        readmes = readmes_collection.find({'user_id': user_id}).sort('created_at', -1)
        results = []
        
        for r in readmes:
            results.append({
                'id': str(r['_id']),
                'filename': r['filename'],
                'created_at': r['created_at'],
                'prompt': r.get('prompt', ''),
                'model': r.get('model', ''),
                'total_tokens': r.get('total_tokens', 0)
            })

        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing READMEs: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/readme/<readme_id>', methods=['GET'])
def download_readme(readme_id):
    """Download a specific README by ID"""
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(readme_id):
            return jsonify({'error': 'Invalid README ID'}), 400
            
        readme = readmes_collection.find_one({
            '_id': ObjectId(readme_id),
            'user_id': user_id
        })

        if not readme:
            return jsonify({'error': 'README not found'}), 404

        readme_bytes = BytesIO(readme['content'].encode('utf-8'))
        readme_bytes.seek(0)

        return send_file(
            readme_bytes,
            mimetype='text/markdown',
            as_attachment=True,
            download_name=f"README_{readme['filename']}.md"
        )

    except Exception as e:
        logger.error(f"Error retrieving README {readme_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500




@app.route('/delete/<string:id>', methods=['DELETE'])
def delete_readme(id):
    """
    Delete a README document by ID
    """
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Validate the ID format (assuming ObjectId format)
    try:
        from bson import ObjectId
        if not ObjectId.is_valid(id):
            return jsonify({'error': 'Invalid ID format'}), 400
        object_id = ObjectId(id)
    except Exception:
        return jsonify({'error': 'Invalid ID format'}), 400
    
    try:
        # Find the document first to check if it exists and belongs to the user
        document = readmes_collection.find_one({
            '_id': object_id,
            'user_id': user_id
        })
        
        if not document:
            return jsonify({'error': 'README not found or you do not have permission to delete it'}), 404
        
        # Delete the document
        result = readmes_collection.delete_one({
            '_id': object_id,
            'user_id': user_id
        })
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Failed to delete README'}), 500
        
        logger.info(f"README deleted successfully: {id} by user: {user_id}")
        return jsonify({
            'message': 'README deleted successfully',
            'deleted_id': id
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting README {id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500






@app.route('/usage', methods=['GET'])
def usage_stats():
    """Get usage statistics for the authenticated user, including daily token usage"""
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        # Get all usage records for the user
        usage_cursor = usage_collection.find({'user_id': user_id}).sort('timestamp', -1)
        
        total_tokens = 0
        daily_tokens = 0
        usage_log = []
        
        # Get current time and calculate start of day (UTC)
        now = time.time()
        today_start = now - (now % 86400)  # 86400 seconds in a day
        today_end = today_start + 86400
        
        for entry in usage_cursor:
            # Create log entry
            log_entry = {
                'readme_id': str(entry.get('readme_id', '')),
                'timestamp': entry['timestamp'],
                'tokens_used': entry['tokens_used'],
                'model': entry.get('model', 'unknown'),
                'is_today': today_start <= entry['timestamp'] < today_end
            }
            usage_log.append(log_entry)
            
            # Update totals
            total_tokens += entry['tokens_used']
            
            # Check if entry is from today
            if today_start <= entry['timestamp'] < today_end:
                daily_tokens += entry['tokens_used']

        return jsonify({
            'total_tokens_used': total_tokens,
            'daily_tokens_used': daily_tokens,
            'total_generations': len(usage_log),
            'daily_generations': sum(1 for log in usage_log if log['is_today']),
            'logs': usage_log
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500



@app.route('/save_apikey', methods=['POST'])
def save_apikey():
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    api_key = data.get('api_key')
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400

    try:
        # Save or update the API key
        result = user_collection.update_one(
            {'user_id': user_id},
            {'$set': {'api_key': api_key}},
            upsert=True
        )
        return jsonify({'message': 'API key saved successfully'}), 200
    except Exception as e:
        logger.error(f"Error saving API key: {e}")
        return jsonify({'error': 'Internal server error'}), 500




@app.route('/get_apikey', methods=['GET'])
def get_apikey():
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        user_doc = user_collection.find_one({'user_id': user_id})
        if not user_doc or 'api_key' not in user_doc:
            return jsonify({'api_key': None}), 200

        return jsonify({'api_key': user_doc['api_key']}), 200
    except Exception as e:
        logger.error(f"Error retrieving API key: {e}")
        return jsonify({'error': 'Internal server error'}), 500





@app.route('/delete-account', methods=['DELETE'])
def delete_account():
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        # Delete user document
        user_result = user_collection.delete_one({'user_id': user_id})

        # Delete all readmes by this user
        readmes_result = readmes_collection.delete_many({'user_id': user_id})

        # Delete all usage records by this user
        usage_result = usage_collection.delete_many({'user_id': user_id})

        logger.info(f"Deleted account for user_id={user_id}. "
                    f"User: {user_result.deleted_count}, "
                    f"Readmes: {readmes_result.deleted_count}, "
                    f"Usage: {usage_result.deleted_count}")

        return jsonify({
            'message': 'Account and associated data deleted successfully.',
            'deleted': {
                'user': user_result.deleted_count,
                'readmes': readmes_result.deleted_count,
                'usage': usage_result.deleted_count
            }
        }), 200

    except Exception as e:
        logger.error(f"Error deleting account for user_id={user_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500






@app.route('/generate', methods=['POST'])
def generate_readme():
    """Main endpoint to handle README generation"""
    # Authentication
    user_id = get_user_id_from_request(request)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401

    # Validate file upload
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    zip_file = request.files['file']
    if zip_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file size
    zip_file.stream.seek(0, os.SEEK_END)
    file_size = zip_file.stream.tell()
    zip_file.stream.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        return jsonify({
            'error': f'File too large ({file_size//1024//1024} MB). Maximum size is {MAX_FILE_SIZE//1024//1024} MB'
        }), 400
    
    # Validate ZIP file
    is_valid, validation_message = validate_zip_file(zip_file)
    if not is_valid:
        return jsonify({'error': validation_message}), 400
    
    zip_file.stream.seek(0)  # Reset stream position
    
    # Get and validate form data
    api_key = request.form.get('api_key', '').strip()
    user_prompt = request.form.get('prompt', 'Generate comprehensive README documentation').strip()
    model_name = request.form.get('model', 'gemini-1.5-flash').strip()
    
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    
    # Validate model name
    allowed_models = ['gemini-2.0-flash','gemini-2.5-flash','gemini-1.5-flash','gemini-pro']
    if model_name not in allowed_models:
        return jsonify({'error': f'Invalid model. Allowed models: {", ".join(allowed_models)}'}), 400
    
    logger.info(f"Starting README generation for user {user_id}")
    logger.info(f"File: {zip_file.filename}, Size: {file_size} bytes, Model: {model_name}")
    
    readme_content = None
    total_tokens = 0
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save and extract ZIP file
            zip_path = os.path.join(tmpdir, secure_filename(zip_file.filename))
            zip_file.save(zip_path)
            
            extract_dir = os.path.join(tmpdir, 'project')
            os.makedirs(extract_dir, exist_ok=True)
            
            # Safe extraction
            safe_extract_zip(zip_path, extract_dir)
            
            # Check if extraction was successful
            if not os.listdir(extract_dir):
                return jsonify({'error': 'ZIP file appears to be empty or could not be extracted'}), 400
            
            # Process project
            logger.info(f"Processing project: {zip_file.filename}")
            processor = ProjectProcessor(
                project_dir=extract_dir,
                api_key=api_key,
                user_prompt=user_prompt,
                model_name=model_name
            )
            
            readme_content = processor.process()
            total_tokens = processor.token_count

        # Store the README and usage in MongoDB
        if readme_content:
            readme_doc = {
                'user_id': user_id,
                'filename': secure_filename(zip_file.filename),
                'content': readme_content,
                'created_at': time.time(),
                'prompt': user_prompt,
                'model': model_name,
                'total_tokens': total_tokens
            }
            
            inserted = readmes_collection.insert_one(readme_doc)
            logger.info(f"README saved with ID: {inserted.inserted_id}")
            
            # Record usage
            usage_doc = {
                'user_id': user_id,
                'readme_id': inserted.inserted_id,
                'timestamp': time.time(),
                'tokens_used': total_tokens,
                'model': model_name
            }
            usage_collection.insert_one(usage_doc)
            
            # Create download response
            readme_bytes = BytesIO(readme_content.encode('utf-8'))
            readme_bytes.seek(0)

            logger.info("README generated and saved successfully")
            return send_file(
                readme_bytes,
                mimetype='text/markdown',
                as_attachment=True,
                download_name='README.md'
            )
        else:
            return jsonify({'error': 'Failed to generate README content'}), 500
    
    except ValueError as e:
        logger.error(f"ValueError in generate_readme: {e}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error in generate_readme: {e}")
        return jsonify({'error': 'Internal server error occurred during README generation'}), 500


@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large'}), 413


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': 'Internal server error'}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
    
    logger.info(f"Starting README Generator API on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)