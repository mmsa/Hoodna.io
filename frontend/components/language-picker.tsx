'use client'

import { SUPPORTED_LOCALES, createTranslator, type SupportedLocale } from '@hoodna/i18n'
import { useTranslation } from '@/components/locale-provider'
import { Loader2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  ar: 'العربية',
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
        onValueChange={async (value) => {
          const nextLocale = value as SupportedLocale
          await setLocale(nextLocale)
          const nextT = createTranslator(nextLocale)
          toast({
            title: nextT('settings.saved'),
            description: localeLabels[nextLocale],
            variant: 'success',
          })
        }}
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
