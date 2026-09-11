export type Section = { title: string; rows: string[] }

export const SECTIONS: Section[] = [
  {
    title: "Start of the day – Reception",
    rows: [
      "Occupancy",
      "Check-In / Check-Out",
      "Payments Dues",
      "Cash Payments",
      "Arrivals Confirmation",
      "Check-Outs Review",
      "Hotel Eye",
      "Petty Cash",
    ],
  },
  {
    title: "Maintenance",
    rows: [
      "Water Supply",
      "Hot water / Geyser",
      "Electricity / Generator",
      "Lift working",
      "Plumbing maintenance",
      "Lighting",
      "Wi-Fi",
      "CCTV",
      "Door locks working",
    ],
  },
  {
    title: "Rooms and Public Areas",
    rows: [
      "Lobby tidy and fresh",
      "Mirrors cleaning",
      "All passages and areas cleaning",
      "TV and Remote check",
      "AC cooling",
      "Minibar and Fridge",
      "Tea station",
      "Shower working",
      "Toiletries",
    ],
  },
  {
    title: "Stock Inventory",
    rows: [
      "Chemical Stock",
      "Linen Stock",
      "Housekeeping Stock",
      "Crockery and Cutlery Inventory",
      "Mini Bar stock",
      "Amenities Stock",
      "Guest Supplies",
      "Quilt Stock",
      "Towels Stock",
    ],
  },
]

export const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const

export type DayCell = { label: string; date: Date; number: number }

export const TOTAL_CELLS = SECTIONS.reduce((a, s) => a + s.rows.length, 0) * DAYS.length

export const pad = (n: number) => String(n).padStart(2, "0")

export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })

export function weekRange(start: Date): string {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
}

export function buildDays(start: Date): DayCell[] {
  return DAYS.map((label, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { label, date: d, number: d.getDate() }
  })
}

export const keyOf = (si: number, ri: number, di: number) => `s${si}r${ri}d${di}`

export function countDone(data: Record<string, boolean>): number {
  return Object.values(data).filter(Boolean).length
}