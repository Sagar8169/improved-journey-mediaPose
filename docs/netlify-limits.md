# Netlify Configuration Notes

## Current Setup
- Using @netlify/plugin-nextjs (latest compatible version)
- Publish directory: .next
- Build command: npm run build

## Payload Limits
- Netlify Functions: 6MB maximum request body (synchronous functions)
- For session finish endpoint: Set limit to 2MB for safety margin
- Use Next.js API route config: `{ api: { bodyParser: { sizeLimit: '2mb' } } }`
- Add runtime Content-Length guard to return 413 before parsing

## Recommendations
- Keep @netlify/plugin-nextjs updated for best Next.js 14 compatibility
- Use streaming for large payloads if needed in future
- Monitor function execution time (10s timeout for synchronous functions)

## Configuration
No changes needed to netlify.toml - plugin handles Next.js deployment automatically.