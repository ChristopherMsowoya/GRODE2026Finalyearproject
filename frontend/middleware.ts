import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define routes that require authentication
const protectedRoutes = [
  '/',
  '/map',
  '/crop-stress',
  '/details',
  '/expert-advice',
  '/false-onset',
  '/help',
  '/onset',
  '/planting-guide',
  '/profile',
  '/subscription',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  // Allow access to public routes (sign-in, create-account, API routes)
  const isPublicRoute =
    pathname === '/sign-in' ||
    pathname === '/create-account' ||
    pathname.startsWith('/api/') ||
    pathname === '/' // Root redirects based on auth state

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Check for user session in cookies or localStorage data
  // Note: In a real app, you'd verify a signed JWT token here
  const userCookie = request.cookies.get('user')?.value
  
  // For now, we'll allow the middleware to pass through since we're using client-side auth
  // In production, implement real session tokens here
  
  return NextResponse.next()
}

// Configure which routes trigger middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
