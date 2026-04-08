"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { MessageSquare, ThumbsUp, Share, User, Calendar, MapPin, Loader2, Users, Lightbulb, Share2, Camera, X, Check } from "lucide-react"
import Image from "next/image"

interface Post {
  id: string
  author: {
    name: string
    avatar: string
    district: string
    role: "farmer" | "expert"
  }
  content: string
  timestamp: string
  likes: number
  comments: number
  tags: string[]
  image?: string
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    author: {
      name: "John Banda",
      avatar: "JB",
      district: "Lilongwe",
      role: "farmer"
    },
    content: "Just planted maize following the onset prediction. The soil moisture readings were very helpful. Anyone else in Lilongwe district doing the same?",
    timestamp: "2 hours ago",
    likes: 12,
    comments: 5,
    tags: ["maize", "planting", "lilongwe"],
    image: "/farmland_hero.png"
  },
  {
    id: "2",
    author: {
      name: "Dr. Mary Chilenga",
      avatar: "MC",
      district: "Blantyre",
      role: "expert"
    },
    content: "Important update: Current weather models show a potential dry spell starting November 20th. Farmers should consider delaying planting if possible. Monitor soil moisture closely.",
    timestamp: "4 hours ago",
    likes: 28,
    comments: 12,
    tags: ["weather-update", "dry-spell", "expert-advice"]
  },
  {
    id: "3",
    author: {
      name: "Peter Nkhoma",
      avatar: "PN",
      district: "Dedza",
      role: "farmer"
    },
    content: "Experiencing some crop stress in my fields. The dashboard shows medium risk. Any tips on irrigation techniques that work well in Dedza?",
    timestamp: "1 day ago",
    likes: 8,
    comments: 3,
    tags: ["crop-stress", "irrigation", "dedza"]
  }
]

// ─── Create Post Card Component ──────────────────────────────────────────────
function CreatePostCard() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [postContent, setPostContent] = useState("")
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [showLocationMenu, setShowLocationMenu] = useState(false)

  const districts = ["Lilongwe", "Blantyre", "Dedza", "Zomba", "Mchinji", "Kasungu", "Mangochi", "Salima", "Nkhotakota"]

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedPhoto(file)
    }
  }

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location)
    setShowLocationMenu(false)
  }

  const handlePost = () => {
    if (postContent.trim()) {
      console.log("Posting:", { content: postContent, photo: selectedPhoto, location: selectedLocation })
      // Reset form
      setPostContent("")
      setSelectedPhoto(null)
      setSelectedLocation(null)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F2A3D] text-white font-bold text-sm flex-shrink-0">
        <User className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <textarea
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          placeholder="Share your farming experience or ask a question..."
          className="w-full p-3 border border-[#e2e8f0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20 text-[14px]"
          rows={3}
        />

        {/* Selected attachments preview */}
        {(selectedPhoto || selectedLocation) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {selectedPhoto && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#E9F5EC] border border-[#1F7A63] rounded-lg text-[12px] font-medium text-[#1F7A63]">
                <Check className="h-3.5 w-3.5" />
                {selectedPhoto.name}
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  title="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedLocation && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#E9F5EC] border border-[#1F7A63] rounded-lg text-[12px] font-medium text-[#1F7A63]">
                <MapPin className="h-3.5 w-3.5" />
                {selectedLocation}
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  title="Remove location"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mt-3 gap-2">
          <div className="flex gap-1.5">
            {/* Camera Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedPhoto
                  ? "bg-[#E9F5EC] text-[#1F7A63] border border-[#1F7A63]"
                  : "bg-white border border-[#e2e8f0] text-[#6b7a8d] hover:bg-[#f0f4f8] hover:border-[#1F7A63]/30"
              }`}
              title="Attach photo"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Location Button */}
            <div className="relative">
              <button
                onClick={() => setShowLocationMenu(!showLocationMenu)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedLocation
                    ? "bg-[#E9F5EC] text-[#1F7A63] border border-[#1F7A63]"
                    : "bg-white border border-[#e2e8f0] text-[#6b7a8d] hover:bg-[#f0f4f8] hover:border-[#1F7A63]/30"
                }`}
                title="Select location"
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Location</span>
              </button>

              {showLocationMenu && (
                <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg bg-white border border-[#e2e8f0] shadow-lg">
                  <div className="max-h-48 overflow-y-auto">
                    {districts.map((district) => (
                      <button
                        key={district}
                        onClick={() => handleLocationSelect(district)}
                        className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                          selectedLocation === district
                            ? "bg-[#E9F5EC] text-[#1F7A63] font-semibold"
                            : "text-[#1a2332] hover:bg-[#f0f4f8]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {district}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Post Button */}
          <button
            onClick={handlePost}
            disabled={!postContent.trim()}
            className="px-6 py-2 bg-[#1F7A63] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes)

  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#e2e8f0]">
      {/* Author */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F7A63] text-white font-bold text-sm flex-shrink-0">
          {post.author.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#0F2A3D]">{post.author.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              post.author.role === "expert"
                ? "bg-[#1F7A63] text-white"
                : "bg-[#F4A261] text-white"
            }`}>
              {post.author.role === "expert" ? "Expert" : "Farmer"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b7a8d] mt-1">
            <MapPin className="h-3 w-3" />
            {post.author.district} District
            <span>•</span>
            <Calendar className="h-3 w-3" />
            {post.timestamp}
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-[#1a2332] leading-relaxed mb-4">{post.content}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-1 bg-[#f0f4f8] text-[#6b7a8d] rounded-full">
            #{tag}
          </span>
        ))}
      </div>

      {/* Image */}
      {post.image && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <Image
            src={post.image}
            alt="Post image"
            width={500}
            height={300}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#f0f4f8]">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            liked ? "text-[#1F7A63] bg-[#E9F5EC]" : "text-[#6b7a8d] hover:bg-[#f0f4f8]"
          }`}
        >
          <ThumbsUp className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {likeCount}
        </button>

        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#6b7a8d] hover:bg-[#f0f4f8] transition-colors">
          <MessageSquare className="h-4 w-4" />
          {post.comments}
        </button>

        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#6b7a8d] hover:bg-[#f0f4f8] transition-colors">
          <Share className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const router = useRouter()
  const { user, isHydrated } = useUser()
  const [posts] = useState<Post[]>(SAMPLE_POSTS)

  // Show loading state while checking authentication
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1F7A63] mx-auto mb-4" />
          <p className="text-[#6b7a8d]">Loading Community Forum...</p>
        </div>
      </div>
    )
  }

  // Show welcome screen for unauthenticated users
  if (!user) {
    return (
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1F7A63] to-[#156B4E] p-12 text-white shadow-lg">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold mb-4">Welcome to the Community Forum</h1>
            <p className="text-lg text-white/90 leading-relaxed mb-8">
              Join thousands of farmers and agricultural experts across Malawi sharing knowledge, experiences, and best practices. Connect with your community, learn from experts, and grow your farming success together.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E9F5EC] mb-4">
              <Users className="h-6 w-6 text-[#1F7A63]" />
            </div>
            <h3 className="text-xl font-bold text-[#0F2A3D] mb-2">Connect with Farmers</h3>
            <p className="text-[#6b7a8d] leading-relaxed">
              Share your experiences with fellow farmers across all districts in Malawi. Get advice, tips, and support from your agricultural community.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E9F5EC] mb-4">
              <Lightbulb className="h-6 w-6 text-[#1F7A63]" />
            </div>
            <h3 className="text-xl font-bold text-[#0F2A3D] mb-2">Learn from Experts</h3>
            <p className="text-[#6b7a8d] leading-relaxed">
              Get expert advice on crop management, weather patterns, soil health, and optimization techniques from agricultural specialists.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-[#e2e8f0] hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E9F5EC] mb-4">
              <Share2 className="h-6 w-6 text-[#1F7A63]" />
            </div>
            <h3 className="text-xl font-bold text-[#0F2A3D] mb-2">Share & Collaborate</h3>
            <p className="text-[#6b7a8d] leading-relaxed">
              Share photos, discuss seasonal challenges, ask questions, and collaborate on solutions with your peers in real-time.
            </p>
          </div>
        </div>

        {/* Sample Posts Preview */}
        <div>
          <h2 className="text-2xl font-bold text-[#0F2A3D] mb-4">What's Being Discussed</h2>
          <div className="space-y-4">
            {SAMPLE_POSTS.slice(0, 2).map(post => (
              <div key={post.id} className="rounded-2xl bg-white p-6 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F7A63] text-white font-bold text-sm flex-shrink-0">
                    {post.author.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0F2A3D]">{post.author.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        post.author.role === "expert"
                          ? "bg-[#1F7A63] text-white"
                          : "bg-[#F4A261] text-white"
                      }`}>
                        {post.author.role === "expert" ? "Expert" : "Farmer"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6b7a8d] mt-1">
                      <MapPin className="h-3 w-3" />
                      {post.author.district} District
                    </div>
                  </div>
                </div>
                <p className="text-[#1a2332] leading-relaxed text-sm">{post.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-2xl bg-[#0F2A3D] p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-3">Join the Community Today</h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Create an account to start participating in discussions, ask questions, and connect with thousands of farmers and experts improving agricultural practices in Malawi.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => router.push("/create-account")}
              className="px-8 py-3 bg-[#1F7A63] text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Create Account
            </button>
            <button
              onClick={() => router.push("/sign-in?redirect=/community")}
              className="px-8 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated user view - show full forum
  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight leading-tight" style={{ color: "#0F2A3D" }}>
          Community Forum
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "#6b7a8d" }}>
          Connect with fellow farmers and experts across Malawi. Share experiences, ask questions, and learn from the community.
        </p>
      </div>

      {/* Create Post Card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#e2e8f0]">
        <CreatePostCard />
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Load More */}
      <div className="text-center py-8">
        <button className="px-6 py-3 border border-[#e2e8f0] text-[#6b7a8d] font-medium rounded-xl hover:bg-[#f0f4f8] transition-colors">
          Load More Posts
        </button>
      </div>
    </div>
  )
}