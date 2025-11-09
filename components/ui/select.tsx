// components/ui/select.tsx
"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, onValueChange, children }: SelectProps) {
  return (
    <div className="relative inline-block w-full">
      {children}
    </div>
  )
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

export function SelectTrigger({ children, className }: SelectTriggerProps) {
  return (
    <button
      type="button"
      className={`w-full flex items-center justify-between border rounded px-3 py-2 bg-white ${className || ""}`}
    >
      {children}
      <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
    </button>
  )
}

interface SelectValueProps {
  placeholder?: string
  value?: string
}

export function SelectValue({ placeholder = "Select...", value }: SelectValueProps) {
  return (
    <span className="text-sm text-gray-700">
      {value || placeholder}
    </span>
  )
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export function SelectContent({ children, className }: SelectContentProps) {
  return (
    <div
      className={`absolute z-10 mt-1 w-full bg-white border rounded shadow-md ${className || ""}`}
    >
      {children}
    </div>
  )
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  onSelect?: (value: string) => void
}

export function SelectItem({ value, children, onSelect }: SelectItemProps) {
  return (
    <div
      onClick={() => onSelect?.(value)}
      className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
    >
      {children}
    </div>
  )
}
