"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Map, Sun, AlertTriangle, Sprout,
  Headphones, Settings, HelpCircle, UserPlus, Menu, MessageSquare, Crown, Users
} from "lucide-react"
import { useUser } from "@/lib/user-context"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

const navItems = [
  { name: "Dashboard",        href: "/",            icon: LayoutDashboard },
  { name: "Map",              href: "/map",          icon: Map             },
  { name: "Onset Info",       href: "/onset",        icon: Sun             },
  { name: "False-Onset",      href: "/false-onset",  icon: AlertTriangle   },
  { name: "Crop Stress",      href: "/crop-stress",  icon: Sprout          },
  { name: "Community",        href: "/community",    icon: Users           },
  { name: "Subscription",     href: "/subscription", icon: Crown           },
]

const footerNavItems = [
  { name: "Settings", href: "/settings", icon: Settings },
]

function SidebarInner({ pathname, user }: { pathname: string, user: any }) {
  return (
    <>
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-7 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <svg className="h-10 w-8 flex-shrink-0 drop-shadow-md" viewBox="-5 -5 50 110" xmlns="http://www.w3.org/2000/svg">
            <path d="M 4.693714973502262,0.5344034880399617 L 4.802023028513796,3.199776333430231 L 8.194966765172133,5.615641229297558 L 10.796937008004267,10.390098917234178 L 12.457621864342647,16.148812175279115 L 8.964461609497322,18.5396164992933 L 8.473785920303719,21.932551216722448 L 8.387526014677038,25.289014749222726 L 7.523464554868284,27.548761945904626 L 7.779626118429175,34.74131743310274 L 10.764829841422564,38.24998431942633 L 7.751051912671551,40.9754136334356 L 3.941410779545363,43.254789249223144 L 3.368176933976965,51.60725236714861 L 1.4605455891360586,55.16126278275969 L 4.080412559116546,58.89422500832295 L 7.530721168784399,59.74496120159629 L 8.062792541911945,61.51210517101339 L 9.26571674085879,62.773731665775706 L 10.69153701009628,65.00333788778649 L 12.257026481848241,66.42267461987437 L 13.367689122536422,66.51690752388741 L 16.14591442586495,65.90761093561446 L 21.953648481685466,64.75779839899973 L 24.21057137124568,67.92921698816608 L 25.074413792637486,72.29464491269867 L 24.460146320755417,74.16980316795542 L 24.710523981640073,76.37496985644904 L 23.850704136357496,77.54070648599574 L 22.792950869579872,78.52550578676308 L 22.99441982882067,80.43754109225151 L 21.673941576733633,82.15297137982233 L 20.388617702148544,83.47329759347922 L 21.310010534974296,84.82749101182353 L 22.693131197466503,86.42456711179932 L 22.450140285087443,88.27397933380256 L 23.941005945011796,89.15355902124226 L 24.75597831859871,90.65544746739812 L 25.928873639005054,91.76315308945509 L 27.073708849703763,92.92427702762721 L 28.08186924189817,93.49755596934077 L 28.92401139845053,94.93687544738565 L 29.950494998476184,95.67144654877673 L 31.00755893847028,96.08840679134526 L 31.99387475816273,96.61152335859165 L 31.448962579940204,98.02210886168102 L 31.089700921852245,99.22169208053501 L 34.01054600402063,99.36712843572776 L 33.53234133153343,97.37765403052094 L 33.735340982772925,94.6994558415716 L 31.884057914993928,92.85272877287122 L 33.413648278623356,90.69344032509632 L 34.18435427654982,88.02842824886444 L 36.20074334938843,87.0097114934201 L 37.13496796807947,87.17111059538321 L 38.71075353390168,86.74725966190074 L 40.01525744306706,86.16763375993311 L 40.41539811211584,85.23346583353727 L 28.296392890806636,53.47338366269264 L 28.032258328858404,55.69597936689059 L 31.343603812793955,57.67698858150179 L 32.416247826559044,60.6629975927938 L 32.92841118448289,62.9049202161587 L 32.99143755634701,65.07168689318972 L 31.111680782790682,62.84049715226889 L 29.216810358445514,61.55323672038431 L 28.860094699842293,60.20559383917627 L 27.642498792325206,61.510160882944625 L 26.18975870161034,63.42030472727705 L 24.90451857700892,61.780737751281755 L 23.860864941994194,59.18448827652301 L 24.82721090034116,55.457614030498334 L 23.679842574770824,54.39445309173782 L 21.312932765152798,52.123720474201434 L 21.509423110016694,49.56290368458206 L 21.3612500630701,47.98453861928207 L 21.11000011389998,46.14203899203393 L 20.581730990003607,43.571558742831094 L 19.377019695264448,39.37439613041093 L 17.834243218918775,35.212091549400625 L 19.433651433807945,31.938840711604083 L 21.155096258622777,29.272859712491 L 20.713798270977676,26.956850565652854 L 19.97615418943957,24.650504878398177 L 20.078675764852004,22.291495913336167 L 19.93750035110569,20.665938376814346 L 19.87307728721586,18.407909987477016 L 19.43177929957076,15.628054780632347 L 20.301490662083033,13.076901450596445 L 18.784327507478338,11.260171048904214 L 17.18019321662237,9.16964262568035 L 16.157705135018613,6.623889236859945 L 16.018453393959454,4.316743415151514 L 15.49823844151041,3.8762726196467443 L 14.597082181513821,3.0975768733371836 L 12.752630535429605,3.1072983136780077 L 10.65397063308185,3.2271638663507094 L 9.22565847973218,2.1812979433227055 L 7.832231415479564,1.7071673853965172 L 6.54786873300823,1.6842482361870799 L 5.419690749709254,1.0618080544189006 L 4.693714973502262,0.5344034880399617 Z" fill="#1F7A63" />
          </svg>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: "#0F2A3D" }}>Climate Intel</h2>
            <p className="text-[11px] text-[#6b7a8d]">Malawi District Portal</p>
          </div>
        </div>
      </div>

      {/* ── Main Nav ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 px-4 py-5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-[13.5px] font-medium transition-all duration-200",
                isActive ? "nav-active text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f0f4f8] hover:text-[#0F2A3D]"
              )}
              style={isActive ? { background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 100%)" } : undefined}
            >
              <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-white" : "text-[#6b7a8d]")} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6 space-y-1">
        {footerNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive ? "nav-active text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f0f4f8] hover:text-[#0F2A3D]"
              )}
              style={isActive ? { background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 100%)" } : undefined}
            >
              <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-white" : "text-[#6b7a8d]")} />
              {item.name}
            </Link>
          )
        })}

        {/* ── User card / Create Account ─────────────────────────────────── */}
        <div className="pt-3 space-y-2">
          {!user && (
            <Link href="/create-account"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:bg-muted border border-border text-primary">
              <UserPlus className="h-4 w-4" />
              Create Account
            </Link>
          )}

          {/* Get Support always visible */}
          <Link href="/help"
            className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
            style={{ background: "#0B6B3A", borderRadius: "999px" }}>
            <Headphones className="h-4 w-4" />
            Help & Support
          </Link>
        </div>
      </div>
    </>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <aside
      className="hidden md:flex h-screen flex-col border-r border-sidebar-border bg-white"
      style={{ width: "260px", minWidth: "260px" }}
    >
      <SidebarInner pathname={pathname} user={user} />
    </aside>
  )
}

export function MobileSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-md hover:bg-[#f0f4f8] text-[#0F2A3D]">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[260px] flex flex-col bg-white [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarInner pathname={pathname} user={user} />
      </SheetContent>
    </Sheet>
  )
}
