import { LogOut, Sparkles, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** The signed-in user's email, from the login response kept in the session. */
const readSessionEmail = (): string => {
  try {
    const raw = sessionStorage.getItem("userInfo")
    if (raw) {
      const info = JSON.parse(raw)
      return String(info?.email || info?.gmail || info?.emailId || info?.emailid || "").trim()
    }
  } catch {
    // ignore parse errors
  }
  return ""
}

interface HeaderAccountControlsProps {
  displayName: string
  tokenCount: number
  onLogout: () => void
  /** Logout is left out where the page does not offer it (for example Super Admin). */
  showLogout?: boolean
}

/**
 * The two round buttons at the right of every header: tokens usages (revealed only
 * when opened) and the account avatar, whose menu holds the name, email and
 * Logout. One component so every page shows them the same way.
 */
export function HeaderAccountControls({
  displayName,
  tokenCount,
  onLogout,
  showLogout = true,
}: HeaderAccountControlsProps) {
  const name = String(displayName || "").trim() || "User"
  const email = readSessionEmail()

  return (
    <>
      {/* Tokens are behind their own button: the count shows once it is opened. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Tokens Usages"
            aria-label="Tokens Usages"
            className="h-9 w-9 shrink-0 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center transition-all outline-none hover:bg-purple-100 hover:border-purple-500 hover:ring-2 hover:ring-purple-200 focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="text-xs text-slate-500">Tokens Usages</p>
            <p className="text-base font-semibold text-purple-600">{(tokenCount || 0).toLocaleString()}</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Account: an avatar carrying the first letter of the name. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Account"
            aria-label={`Account: ${name}`}
            className="h-9 w-9 shrink-0 rounded-full bg-teal-100 border border-teal-200 text-teal-700 text-sm font-bold flex items-center justify-center transition-all outline-none hover:bg-teal-200 hover:border-teal-500 hover:ring-2 hover:ring-teal-200 focus-visible:ring-2 focus-visible:ring-teal-300"
          >
            {name.charAt(0).toUpperCase()}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="px-2 py-1.5 flex items-start gap-2">
            <User className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
              {email && <p className="text-xs text-slate-500 truncate">{email}</p>}
            </div>
          </div>
          {showLogout && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export default HeaderAccountControls
