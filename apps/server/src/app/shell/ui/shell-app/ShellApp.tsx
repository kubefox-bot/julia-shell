import { useEffect, useRef, useState } from 'react'
import { CLOCK_TICK_INTERVAL_MS, SHELL_BOOT_DELAY_MS } from '@app/shell/model/constants'
import { useResolvedShellTheme, useShellLoadingState } from '@app/shell/model/selectors'
import { useShellStore } from '@app/shell/model/store'
import { buildShellStatePatch } from '@app/shell/model/store-helpers'
import type { ShellSettingsResponse } from '@app/shell/model/types'
import { ShellBootSkeleton, ShellHeaderActions, ShellSettingsOverlay, WidgetGrid } from '@app/shell/ui/components'
import { logger } from '@shared/lib/logger'
import styles from './ShellApp.module.css'

type ShellAppProps = {
  initialShellSettings?: ShellSettingsResponse
  initialNowIso?: string
}

export function ShellApp({ initialShellSettings, initialNowIso }: ShellAppProps) {
  const hasSeededClockRef = useRef(false)
  const hasSeededShellStateRef = useRef(false)

  if (!hasSeededClockRef.current && initialNowIso) {
    useShellStore.setState({ nowIso: initialNowIso })
    hasSeededClockRef.current = true
  }
  if (!hasSeededShellStateRef.current && initialShellSettings) {
    useShellStore.setState((state) => buildShellStatePatch(state, initialShellSettings))
    hasSeededShellStateRef.current = true
  }

  const { loading, error } = useShellLoadingState()
  const theme = useResolvedShellTheme()
  const hydrateShell = useShellStore((state) => state.hydrateShell)
  const loadShell = useShellStore((state) => state.loadShell)
  const syncFromStatus = useShellStore((state) => state.syncFromStatus)
  const statusPollIntervalMs = useShellStore((state) => state.statusPollIntervalMs)
  const tickNow = useShellStore((state) => state.tickNow)
  const [isBootDelayComplete, setIsBootDelayComplete] = useState(false)

  useEffect(() => {
    if (initialShellSettings) {
      if (!hasSeededShellStateRef.current) {
        hydrateShell(initialShellSettings)
      }
    } else {
      void loadShell()
    }

    void syncFromStatus()
  }, [hydrateShell, initialShellSettings, loadShell, syncFromStatus])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void syncFromStatus()
    }, statusPollIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [statusPollIntervalMs, syncFromStatus])

  useEffect(() => {
    tickNow()

    const controller = new AbortController()
    const intervalId = window.setInterval(() => {
      tickNow()
    }, CLOCK_TICK_INTERVAL_MS)

    controller.signal.addEventListener(
      'abort',
      () => {
        window.clearInterval(intervalId)
      },
      { once: true }
    )

    return () => {
      controller.abort()
    }
  }, [tickNow])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsBootDelayComplete(true)
    }, SHELL_BOOT_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.shellTheme = theme
    document.body.dataset.shellTheme = theme

    return () => {
      delete document.documentElement.dataset.shellTheme
      delete document.body.dataset.shellTheme
    }
  }, [theme])

  useEffect(() => {
    if (!error) {
      return
    }

    logger.error('[shell] load error', error)
  }, [error])

  useEffect(() => {
    if (!initialShellSettings || !isBootDelayComplete) {
      return
    }

    window.dispatchEvent(new CustomEvent('yulia-shell-hydrated'))
  }, [initialShellSettings, isBootDelayComplete])

  const showBootSkeleton = !initialShellSettings && (loading || !isBootDelayComplete)

  return (
    <div id="shell-root" className={styles.shellRoot} data-theme={theme}>
      <ShellHeaderActions initialLocale={initialShellSettings?.layoutSettings.locale ?? 'ru'} />
      {!showBootSkeleton ? <ShellSettingsOverlay /> : null}
      {showBootSkeleton ? (
        <ShellBootSkeleton
          animate={!isBootDelayComplete}
          initialShellSettings={initialShellSettings}
        />
      ) : (
        <WidgetGrid />
      )}
    </div>
  )
}
