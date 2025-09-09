import json
import base64
import binascii
from urllib.parse import unquote

# Embedded static files (populated by Terraform with Base64 strings)
STATIC_FILES = {
                   'index.html': '${index_html}',
                   'README.md': '${readme_md}',
               %{ for filename, content in css_files ~}
'css/${filename}': '${content}',
%{ endfor ~}
%{ for filename, content in js_files ~}
'js/${filename}': '${content}',
%{ endfor ~}
%{ for filename, content in abi_files ~}
'ABI/${filename}': '${content}',
%{ endfor ~}
}

def get_content_type(path):
    """Get content type based on file extension"""
    path_lower = path.lower()

    if path_lower.endswith('.css'):
        return 'text/css; charset=utf-8'
    elif path_lower.endswith('.js'):
        return 'application/javascript; charset=utf-8'
    elif path_lower.endswith('.html'):
        return 'text/html; charset=utf-8'
    elif path_lower.endswith('.json'):
        return 'application/json; charset=utf-8'
    elif path_lower.endswith('.md'):
        return 'text/markdown; charset=utf-8'
    elif path_lower.endswith('.png'):
        return 'image/png'
    elif path_lower.endswith('.jpg') or path_lower.endswith('.jpeg'):
        return 'image/jpeg'
    elif path_lower.endswith('.gif'):
        return 'image/gif'
    elif path_lower.endswith('.svg'):
        return 'image/svg+xml'
    elif path_lower.endswith('.ico'):
        return 'image/x-icon'
    elif path_lower.endswith('.woff'):
        return 'font/woff'
    elif path_lower.endswith('.woff2'):
        return 'font/woff2'
    elif path_lower.endswith('.ttf'):
        return 'font/ttf'
    else:
        return 'application/octet-stream'

def _is_text_mime(content_type: str) -> bool:
    if not content_type:
        return False
    ct = content_type.split(';', 1)[0].strip().lower()
    return ct.startswith('text/') or ct in {
        'application/javascript',
        'application/json',
        'image/svg+xml',
    }

def lambda_handler(event, context):
    """
    AWS Lambda handler for serving static files

    Handles:
    - Cache-busting query parameters (?v=123456)
    - URL fragments (#section)
    - Base href "/"
    - Correct MIME types for CSS/JS/HTML/MD/etc
    - CORS headers
    - Robust Base64/text handling (prevents 500s on README.md)
    """
    try:
        print(f"Event: {json.dumps(event)}")

        # Resolve path for various API Gateway payloads
        if 'rawPath' in event:
            path = event['rawPath']
        elif 'path' in event:
            path = event['path']
        elif 'pathParameters' in event and event['pathParameters'] and 'proxy' in event['pathParameters']:
            path = '/' + event['pathParameters']['proxy']
        else:
            path = '/'

        # Normalize and strip params/fragments
        if path.startswith('/'):
            path = path[1:]
        path = unquote(path)
        if '?' in path:
            path = path.split('?', 1)[0]
        if '#' in path:
            path = path.split('#', 1)[0]

        # Default to index.html
        if path == '' or path == '/':
            path = 'index.html'

        print(f"Requested path: '{path}'")
        print(f"Available files: {list(STATIC_FILES.keys())}")

        # Serve embedded file
        if path in STATIC_FILES:
            file_content = STATIC_FILES[path]
            content_type = get_content_type(path)

            # Caching: long for versioned assets, short for docs/html
            # ETag helps with cache validation
            import hashlib
            etag = f'"{hashlib.md5(file_content.encode()).hexdigest()}"'
            
            cache_control = (
                'public, max-age=31536000, immutable'
                if path.startswith(('css/', 'js/', 'ABI/'))
                else 'public, max-age=300, must-revalidate'
            )

            headers = {
                'Content-Type': content_type,
                'Cache-Control': cache_control,
                'ETag': etag,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }

            # Strict Base64 first (Terraform embeds Base64 via filebase64)
            try:
                raw = base64.b64decode(file_content, validate=True)
                if _is_text_mime(content_type):
                    # Text → return decoded UTF-8, not base64
                    body = raw.decode('utf-8')
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': body,
                        'isBase64Encoded': False
                    }
                else:
                    # Binary → return base64-encoded body
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': base64.b64encode(raw).decode('utf-8'),
                        'isBase64Encoded': True
                    }
            except (binascii.Error, ValueError, UnicodeDecodeError):
                # If someone injected non-Base64 text (e.g., README.md plain content),
                # serve it as text (no 500)
                if _is_text_mime(content_type):
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': file_content,
                        'isBase64Encoded': False
                    }
                # Binary but not Base64 → meaningful 500
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                    },
                    'body': f'Binary asset for {path} was not Base64-encoded in STATIC_FILES.',
                    'isBase64Encoded': False
                }

        # 404: type-appropriate body
        print(f"File not found: {path}")
        if path.endswith('.css'):
            content_type = 'text/css; charset=utf-8'
            body = f'/* File not found: {path} */'
        elif path.endswith('.js'):
            content_type = 'application/javascript; charset=utf-8'
            body = f'// File not found: {path}'
        elif path.endswith('.md'):
            content_type = 'text/markdown; charset=utf-8'
            body = f'# File not found: {path}'
        else:
            content_type = 'text/plain; charset=utf-8'
            body = f'File not found: {path}'

        return {
            'statusCode': 404,
            'headers': {
                'Content-Type': content_type,
                'Access-Control-Allow-Origin': '*',
            },
            'body': body,
            'isBase64Encoded': False
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
            },
            'body': f'Internal server error: {str(e)}',
            'isBase64Encoded': False
        }
