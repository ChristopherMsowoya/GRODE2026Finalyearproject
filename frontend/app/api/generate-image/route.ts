import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateImage?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.error?.message || 'Failed to generate image' }, { status: response.status })
    }

    const data = await response.json()
    
    // Extract base64 image from response
    if (data.draws && data.draws[0]?.image?.imageBytes) {
      const base64Image = data.draws[0].image.imageBytes
      const responseData = NextResponse.json({
        success: true,
        image: `data:image/png;base64,${base64Image}`
      })
      
      // Add cache control headers for 1 hour ttl
      responseData.headers.set('Cache-Control', 'public, max-age=3600')
      responseData.headers.set('Content-Type', 'application/json')
      
      return responseData
    }

    return NextResponse.json({ error: 'No image data in response' }, { status: 500 })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
