"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { Camera, MapPin, Send, Image as ImageIcon, Loader2 } from "lucide-react"
import Link from "next/link"

// Mock forum posts data
const mockPosts = [
  {
    id: 1,
    author: "Chimwemwe Banda",
    role: "Farmer",
    district: "Lilongwe",
    content: "Just planted maize in Area 49. Any tips on irrigation?",
    timestamp: "2 hours ago",
    location: "Area 49, Lilongwe",
    image: null,
  },
  {
    id: 2,
    author: "Dr. Mary Nkosi",
    role: "Agronomist",
    district: "Blantyre",
    content: "Heavy rains expected this week. Farmers in southern districts should prepare for potential flooding.",
    timestamp: "4 hours ago",
    location: "Blantyre District",
    image: null,
  },
]

export default function ForumPage() {
  const { user, isHydrated } = useUser()
  const router = useRouter()
  const [newPost, setNewPost] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [location, setLocation] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)

  useEffect(() => {
    if (isHydrated && !user) {
      router.push("/sign-in?redirect=/forum")
    }
  }, [user, isHydrated, router])

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F7A63]" />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleCameraCapture = () => {
    // In a real app, this would open camera
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => handleImageUpload(e as any)
    input.click()
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.")
      return
    }

    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        setDetectingLocation(false)
      },
      (error) => {
        console.error("Error getting location:", error)
        alert("Unable to retrieve your location. Please enter it manually.")
        setDetectingLocation(false)
      }
    )
  }

  const handlePost = async () => {
    if (!newPost.trim()) return

    setIsPosting(true)
    // Simulate posting
    setTimeout(() => {
      setNewPost("")
      setSelectedImage(null)
      setImagePreview(null)
      setLocation("")
      setIsPosting(false)
      // In real app, would add to posts array
    }, 1500)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F2A3D] mb-2">Community Forum</h1>
        <p className="text-[#6b7a8d]">Connect with farmers and experts in your area</p>
      </div>

      {/* New Post Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="space-y-4">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share your farming experiences, ask questions, or provide advice..."
            className="w-full min-h-[100px] p-4 border border-[#e2e8f0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1F7A63] focus:border-transparent"
          />

          {/* Location Input */}
          {location && (
            <div className="flex items-center gap-2 p-3 bg-[#f0f4f8] rounded-lg">
              <MapPin className="h-4 w-4 text-[#1F7A63]" />
              <span className="text-sm text-[#6b7a8d]">{location}</span>
              <button
                onClick={() => setLocation("")}
                className="ml-auto text-[#6b7a8d] hover:text-[#D64545]"
              >
                ×
              </button>
            </div>
          )}

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => {
                  setSelectedImage(null)
                  setImagePreview(null)
                }}
                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
              >
                ×
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCameraCapture}
                className="flex items-center gap-2 px-4 py-2 text-[#1F7A63] border border-[#1F7A63] rounded-lg hover:bg-[#1F7A63] hover:text-white transition-colors"
                title="Upload Image"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Camera</span>
              </button>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center gap-2 px-4 py-2 text-[#1F7A63] border border-[#1F7A63] rounded-lg hover:bg-[#1F7A63] hover:text-white transition-colors cursor-pointer"
                title="Upload Image"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </label>

              <button
                onClick={detectLocation}
                disabled={detectingLocation}
                className="flex items-center gap-2 px-4 py-2 text-[#1F7A63] border border-[#1F7A63] rounded-lg hover:bg-[#1F7A63] hover:text-white transition-colors disabled:opacity-50"
                title="Attach Location"
              >
                {detectingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {detectingLocation ? "Detecting..." : "Location"}
                </span>
              </button>
            </div>

            <button
              onClick={handlePost}
              disabled={!newPost.trim() || isPosting}
              className="flex items-center gap-2 px-6 py-2 bg-[#1F7A63] text-white rounded-lg hover:bg-[#0F2A3D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isPosting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {mockPosts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1F7A63] rounded-full flex items-center justify-center text-white font-bold">
                {post.author.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-[#0F2A3D]">{post.author}</span>
                  <span className="text-sm text-[#6b7a8d]">{post.role}</span>
                  <span className="text-sm text-[#6b7a8d]">•</span>
                  <span className="text-sm text-[#6b7a8d]">{post.timestamp}</span>
                </div>
                <p className="text-[#1a2332] mb-3">{post.content}</p>
                {post.location && (
                  <div className="flex items-center gap-1 text-sm text-[#6b7a8d] mb-3">
                    <MapPin className="h-3 w-3" />
                    {post.location}
                  </div>
                )}
                {post.image && (
                  <img
                    src={post.image}
                    alt="Post image"
                    className="rounded-lg max-w-full h-auto"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}