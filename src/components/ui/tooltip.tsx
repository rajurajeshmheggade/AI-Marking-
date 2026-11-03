import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

type TooltipContextType = {
  setOpen: (v: boolean) => void
  setLastPointer: (v: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextType | null>(null)

// Controlled Tooltip root: only allow opening when a pointer interaction
// (pointerenter) triggered it. This prevents focus-based opening when
// dialogs programmatically focus elements.
const Tooltip: React.FC<React.ComponentProps<typeof TooltipPrimitive.Root>> = ({ children, ...rest }) => {
  const [open, setOpen] = React.useState(false)
  const lastPointerRef = React.useRef(false)

  const setLastPointer = (v: boolean) => { lastPointerRef.current = v }

  const handleOpenChange = (v: boolean) => {
    // If trying to open but last interaction wasn't pointer, ignore.
    if (v && !lastPointerRef.current) {
      setOpen(false)
      return
    }
    setOpen(v)
  }

  return (
    <TooltipContext.Provider value={{ setOpen: (v: boolean) => setOpen(v), setLastPointer }}>
      <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange} {...rest}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipContext.Provider>
  )
}

// TooltipTrigger will use pointer events to open/close the tooltip and will
// block focus from opening it.
const TooltipTrigger: React.FC<React.ComponentProps<typeof TooltipPrimitive.Trigger>> = (props) => {
  const ctx = React.useContext(TooltipContext)
  const { children, ...rest } = props as any

  const onPointerEnter = (e: React.PointerEvent) => {
    try { ctx?.setLastPointer(true) } catch (e) { void e }
    try { ctx?.setOpen(true) } catch (e) { void e }
  }
  const onPointerLeave = (e: React.PointerEvent) => {
    try { ctx?.setLastPointer(false) } catch (e) { void e }
    try { ctx?.setOpen(false) } catch (e) { void e }
  }

  const onFocusCapture = (e: React.FocusEvent) => {
    // Prevent Radix from opening tooltip via focus when dialogs mount.
    e.stopPropagation()
  }

  if (React.isValidElement(children)) {
    const childProps: any = children.props || {}
    const merged = {
      onPointerEnter: (e: React.PointerEvent) => {
        try { if (typeof childProps.onPointerEnter === 'function') childProps.onPointerEnter(e) } catch (err) { void err }
        onPointerEnter(e)
      },
      onPointerLeave: (e: React.PointerEvent) => {
        try { if (typeof childProps.onPointerLeave === 'function') childProps.onPointerLeave(e) } catch (err) { void err }
        onPointerLeave(e)
      },
      onFocusCapture: (e: React.FocusEvent) => {
        try { if (typeof childProps.onFocusCapture === 'function') childProps.onFocusCapture(e) } catch (err) { void err }
        onFocusCapture(e)
      },
      ...childProps,
    }

    const cloned = React.cloneElement(children, merged)
    return <TooltipPrimitive.Trigger {...rest} asChild>{cloned}</TooltipPrimitive.Trigger>
  }

  return (
    <TooltipPrimitive.Trigger {...rest} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocusCapture={onFocusCapture}>
      {children}
    </TooltipPrimitive.Trigger>
  )
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-visible rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
