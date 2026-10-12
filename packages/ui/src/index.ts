// Components follow the shadcn-cssinjs registry (StyleX + Base UI), ported from
// attentionawareness and web-starter and adapted to the angaria canon
// (docs/relaunch.md). Owned here: edit freely, keep the canon.
export {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  type AccordionItemProps,
  type AccordionPanelProps,
  type AccordionProps,
  type AccordionTriggerProps,
} from './ui/accordion.tsx';
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog.tsx';
export { Badge, type BadgeProps, type BadgeVariant } from './ui/badge.tsx';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './ui/button.tsx';
export {
  Calendar,
  type CalendarProps,
  type CalendarRange,
  RangeCalendar,
  type RangeCalendarProps,
} from './ui/calendar.tsx';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
} from './ui/card.tsx';
export { Checkbox, type CheckboxProps } from './ui/checkbox.tsx';
export { ChoiceChips, type ChoiceChipsProps, type ChoiceOption } from './ui/choice-chips.tsx';
export { Code, CodeBlock } from './ui/code.tsx';
export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from './ui/combobox.tsx';
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/command.tsx';
export { DateField, type DateFieldProps, type DatePreset } from './ui/date-field.tsx';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogProps,
} from './ui/dialog.tsx';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.tsx';
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  FieldWarning,
  SourceLink,
  type SourceLinkProps,
} from './ui/field.tsx';
export { Input, type InputProps } from './ui/input.tsx';
export { Kbd, KbdGroup } from './ui/kbd.tsx';
export { Label, type LabelProps } from './ui/label.tsx';
export { MaskedInput, type MaskedInputProps } from './ui/masked-input.tsx';
export { McpIcon } from './ui/mcp-icon.tsx';
export { NumberInput, type NumberInputProps } from './ui/number-input.tsx';
export { OTPInput, type OTPInputProps } from './ui/otp-input.tsx';
export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './ui/popover.tsx';
export { Progress, type ProgressProps } from './ui/progress.tsx';
export { ScrollArea, ScrollBar } from './ui/scroll-area.tsx';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select.tsx';
export { Separator } from './ui/separator.tsx';
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from './ui/sidebar.tsx';
export { Skeleton } from './ui/skeleton.tsx';
export { SplitButton, type SplitButtonProps } from './ui/split-button.tsx';
export { Toaster } from './ui/sonner.tsx';
export { Switch, type SwitchProps } from './ui/switch.tsx';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table.tsx';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.tsx';
export { Textarea, type TextareaProps } from './ui/textarea.tsx';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip.tsx';
export { Wordmark } from './ui/wordmark.tsx';
// Text that sits by its cap height next to an icon in a flex row.
export { capStyles, capText } from './lib/cap-text.tsx';
// One sonner instance for the Toaster and every toast() call: import toast
// from here, not from 'sonner', or a second copy can swallow the toasts.
export { toast } from 'sonner';
