"use client"

import { useState, useEffect } from "react"
import { Bell, X, AlertTriangle, Info, CheckCircle, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NotificationItem {
  id: string
  type: "info" | "warning" | "success" | "alert"
  title: string
  message: string
  timestamp: Date
  read?: boolean
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

interface NotificationsProps {
  notifications: NotificationItem[]
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
}

const TYPE_CONFIG = {
  info: { icon: Info, color: "#0F2A3D", bg: "rgba(15,42,61,0.1)" },
  warning: { icon: AlertTriangle, color: "#F4A261", bg: "rgba(244,162,97,0.1)" },
  success: { icon: CheckCircle, color: "#1F7A63", bg: "rgba(31,122,99,0.1)" },
  alert: { icon: AlertTriangle, color: "#D64545", bg: "rgba(214,69,69,0.1)" },
}

export function NotificationsPanel({ notifications, onMarkAsRead, onDismiss }: NotificationsProps) {
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="w-80 max-h-96 overflow-hidden rounded-2xl bg-white shadow-lg border border-[#e2e8f0]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#f0f4f8]">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" style={{ color: "#0F2A3D" }} />
          <h3 className="font-semibold" style={{ color: "#0F2A3D" }}>Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-[#D64545] text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2" style={{ color: "#6b7a8d" }} />
            <p className="text-sm" style={{ color: "#6b7a8d" }}>No notifications</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type]
            const Icon = config.icon

            return (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b border-[#f0f4f8] hover:bg-[#f8fafc] transition-colors",
                  !notification.read && "bg-blue-50/50"
                )}
              >
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: config.bg }}
                  >
                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold" style={{ color: "#0F2A3D" }}>
                          {notification.title}
                        </h4>
                        <p className="text-xs mt-1" style={{ color: "#6b7a8d" }}>
                          {notification.message}
                        </p>
                        <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>
                          {notification.timestamp.toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => onDismiss(notification.id)}
                        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100"
                      >
                        <X className="h-3 w-3" style={{ color: "#6b7a8d" }} />
                      </button>
                    </div>

                    {notification.action && (
                      <button
                        onClick={notification.action.onClick}
                        className="mt-2 text-xs font-medium px-3 py-1 rounded-full transition-colors"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {notification.action.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return {
    notifications,
    addNotification,
    markAsRead,
    dismiss,
  }
}