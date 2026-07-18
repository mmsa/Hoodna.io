'use client'

import { SUPPORTED_LOCALES, createTranslator, type SupportedLocale } from '@hoodna/i18n'
import { useTranslation } from '@/components/locale-provider'
import { Globe, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  ar: 'العربية',
}

const localeShort: Record<SupportedLocale, string> = {
  en: 'EN',
  ar: 'ع',
}

async function switchLocale(
  nextLocale: SupportedLocale,
  setLocale: (locale: SupportedLocale) => Promise<void>,
  toast: ReturnType<typeof useToast>['toast'],
) {
  await setLocale(nextLocale)
  const nextT = createTranslator(nextLocale)
  toast({
    title: nextT('settings.saved'),
    description: localeLabels[nextLocale],
    variant: 'success',
  })
}

export function LanguagePicker() {
  const { locale, setLocale, t, ready } = useTranslation()
  const { toast } = useToast()

  if (!ready) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="language">{t('settings.language')}</Label>
      <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
      <Select
        value={locale}
        onValueChange={(value) => void switchLocale(value as SupportedLocale, setLocale, toast)}
      >
        <SelectTrigger id="language" className="w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((option) => (
            <SelectItem key={option} value={option}>
              {localeLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, ready, t } = useTranslation()
  const { toast } = useToast()

  if (!ready) {
    return (
      <Button variant="ghost" size="sm" className={cn('gap-1.5 px-2', className)} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-1.5 px-2 font-semibold', className)}
          aria-label={t('landing.language')}
        >
          <Globe className="h-4 w-4" />
          <span>{localeShort[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((option) => (
          <DropdownMenuItem
            key={option}
            disabled={option === locale}
            onClick={() => void switchLocale(option, setLocale, toast)}
          >
            {localeLabels[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
