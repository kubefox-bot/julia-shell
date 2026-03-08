import type { SVGProps } from 'react'

function BaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function SettingsGlyph() {
  return (
    <BaseIcon style={{ transform: 'rotate(-18deg)' }}>
      <circle cx="12" cy="12" r="2.8" fill="#F8FAFC" stroke="#64748B" />
      <path
        d="M12 4.85v1.65M12 17.5v1.65M19.15 12H17.5M6.5 12H4.85M17.15 6.85l-1.2 1.2M8.05 15.95l-1.2 1.2M17.15 17.15l-1.2-1.2M8.05 8.05l-1.2-1.2"
        stroke="#94A3B8"
      />
      <path
        d="M12 7.15a4.85 4.85 0 1 1 0 9.7 4.85 4.85 0 0 1 0-9.7Z"
        fill="#E2E8F0"
        stroke="#64748B"
      />
      <circle cx="12" cy="12" r="1.65" fill="#FFFFFF" stroke="#475569" />
    </BaseIcon>
  )
}

export function CloseGlyph() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="7.2" fill="#FCE7F3" stroke="#EC4899" />
      <path d="m9.35 9.35 5.3 5.3" stroke="#DB2777" />
      <path d="m14.65 9.35-5.3 5.3" stroke="#DB2777" />
    </BaseIcon>
  )
}

export function FolderGlyph() {
  return (
    <BaseIcon>
      <path
        d="M4.25 8.15a2.4 2.4 0 0 1 2.4-2.4h2.7c.48 0 .94.2 1.27.57l.82.9c.33.36.79.57 1.27.57h4.64a2.4 2.4 0 0 1 2.4 2.4v6.16a2.4 2.4 0 0 1-2.4 2.4H6.65a2.4 2.4 0 0 1-2.4-2.4Z"
        fill="#FDE68A"
        stroke="#D97706"
      />
      <path d="M4.8 10.1h14.4" stroke="#F59E0B" opacity=".7" />
    </BaseIcon>
  )
}

export function AudioGlyph() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="7.2" fill="#CCFBF1" stroke="#0F766E" />
      <path d="M7.25 13.35v-2.7" stroke="#0F766E" />
      <path d="M10.5 15.7V8.3" stroke="#0F766E" />
      <path d="M13.75 17.2V6.8" stroke="#0F766E" />
      <path d="M17 14.6V9.4" stroke="#0F766E" />
    </BaseIcon>
  )
}

export function TextGlyph() {
  return (
    <BaseIcon>
      <rect x="5.2" y="5.4" width="13.6" height="13.2" rx="3" fill="#EDE9FE" stroke="#7C3AED" />
      <path d="M8.2 9.15h7.6" stroke="#7C3AED" />
      <path d="M8.2 12h7.6" stroke="#7C3AED" />
      <path d="M8.2 14.85h5.3" stroke="#7C3AED" />
    </BaseIcon>
  )
}

export function UpGlyph() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="7.2" fill="#EDE9FE" stroke="#8B5CF6" />
      <path d="m12 5.9-4.35 4.35" stroke="#7C3AED" />
      <path d="M12 5.9 16.35 10.25" stroke="#7C3AED" />
      <path d="M12 6.15v12" stroke="#7C3AED" />
    </BaseIcon>
  )
}

export function ReadGlyph() {
  return (
    <BaseIcon>
      <path d="M7.1 5.55h7.95a2.75 2.75 0 0 1 2.75 2.75v9.85l-2.85-2.05-2.95 2.05-2.95-2.05-2.85 2.05V8.3A2.75 2.75 0 0 1 7.1 5.55Z" fill="#DDD6FE" stroke="#7C3AED" />
      <path d="M9 9.35h6" stroke="#6D28D9" />
      <path d="M9 12.15h4.8" stroke="#6D28D9" />
    </BaseIcon>
  )
}

export function WaveGlyph() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="7.2" fill="#CCFBF1" stroke="#14B8A6" />
      <path d="M5.3 12c1 0 1.05-3.5 2.05-3.5S8.4 15.5 9.4 15.5s1.05-8.5 2.05-8.5 1.05 10 2.05 10 1.05-5 2.05-5 1.05 2.5 2.05 2.5" stroke="#0F766E" />
    </BaseIcon>
  )
}

export function BackGlyph() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="7.2" fill="#EDE9FE" stroke="#8B5CF6" />
      <path d="m10.2 7-5 5 5 5" stroke="#7C3AED" />
      <path d="M6.15 12h12.65" stroke="#7C3AED" />
    </BaseIcon>
  )
}

export function CopyGlyph() {
  return (
    <BaseIcon>
      <rect x="8.2" y="8.1" width="9.4" height="9.6" rx="2.6" fill="#DBEAFE" stroke="#2563EB" />
      <path d="M6.8 14.85h-.4a2.4 2.4 0 0 1-2.4-2.4V6.4A2.4 2.4 0 0 1 6.4 4h6.05a2.4 2.4 0 0 1 2.4 2.4v.4" stroke="#1D4ED8" />
    </BaseIcon>
  )
}

export function ExpandGlyph() {
  return (
    <BaseIcon>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.2" fill="#DCFCE7" stroke="#16A34A" />
      <path d="M10.2 13.8H8.2v-2" stroke="#15803D" />
      <path d="m8.2 13.8 4.25-4.25" stroke="#15803D" />
      <path d="M15.8 10.2h-2v-2" stroke="#15803D" />
      <path d="m15.8 10.2-4.25 4.25" stroke="#15803D" />
    </BaseIcon>
  )
}

export function SaveGlyph() {
  return (
    <BaseIcon>
      <path d="M6.4 5.2h9.15l2.25 2.2v10.15a2.2 2.2 0 0 1-2.2 2.2H8.6a2.2 2.2 0 0 1-2.2-2.2Z" fill="#CCFBF1" stroke="#0F766E" />
      <path d="M9.25 5.2v4.4h5.2V5.2" stroke="#0F766E" />
      <path d="M9 15.6h6" stroke="#0F766E" />
    </BaseIcon>
  )
}
