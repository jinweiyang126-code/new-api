/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { useNotifications } from '@/hooks/use-notifications'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'

const AUTH_PROMPT_SECONDS = 5

type AuthPromptTarget = {
  title: string
  href: string
}

export interface PublicHeaderProps {
  navLinks?: TopNavLink[]
  mobileLinks?: TopNavLink[]
  navContent?: React.ReactNode
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showNavigation?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  /** Landing marketing header (Figma Home): flat bar, no Sign In, filter About. */
  variant?: 'default' | 'landing' | 'auth'
  /** Hide Sign in on unauthenticated CTA row (Figma Home only shows Sign Up). */
  showSignIn?: boolean
  className?: string
}

const LANDING_ICON_TRIGGER =
  'size-8 shrink-0 text-foreground hover:bg-transparent hover:opacity-80'
const LANDING_ICON_IMG = 'size-4'

function AuthEntryLinks({
  pathname,
  compact = false,
  stacked = false,
  onNavigate,
}: {
  pathname: string
  compact?: boolean
  stacked?: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const isSignIn = pathname === '/sign-in' || pathname === '/login'
  const to = isSignIn ? '/sign-up' : '/sign-in'
  const label = isSignIn ? t('Sign up') : t('Log in')

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'inline-flex items-center gap-2 font-semibold text-foreground',
        stacked && 'h-11 justify-center rounded-xl border border-border text-sm',
        compact ? 'text-xs' : 'text-sm'
      )}
    >
      {label}
      <ArrowRight className='size-4' />
    </Link>
  )
}

export function PublicHeader(props: PublicHeaderProps) {
  const {
    navLinks = defaultTopNavLinks,
    showThemeSwitch: showThemeSwitchProp = true,
    showLanguageSwitcher: showLanguageSwitcherProp = true,
    logo: customLogo,
    siteName: customSiteName,
    homeUrl = '/',
    showAuthButtons = true,
    showNotifications = true,
    variant = 'default',
    showSignIn = true,
    className,
  } = props

  const isLanding = variant === 'landing'
  const isAuth = variant === 'auth'
  const isMarketing = isLanding || isAuth
  const showThemeSwitch = isAuth ? false : showThemeSwitchProp
  const showLanguageSwitcher = isAuth ? false : showLanguageSwitcherProp
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authPromptTarget, setAuthPromptTarget] =
    useState<AuthPromptTarget | null>(null)
  const [authPromptSecondsLeft, setAuthPromptSecondsLeft] =
    useState(AUTH_PROMPT_SECONDS)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const dynamicLinks = useTopNavLinks()
  const notifications = useNotifications()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const user = auth.user
  const isAuthenticated = !!user
  const displaySiteName =
    customSiteName !== undefined ? customSiteName : systemName
  const rawLinks = dynamicLinks.length > 0 ? dynamicLinks : navLinks
  // Figma Home nav: Home / Console / Model Square / Rankings / Docs (no About)
  const links = isMarketing
    ? rawLinks.filter((link) => link.href !== '/about')
    : rawLinks
  const showSiteName = Boolean(displaySiteName)
  const showSignInButton = showSignIn && !isLanding && !isAuth

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!authPromptTarget) return

    const intervalId = window.setInterval(() => {
      setAuthPromptSecondsLeft((seconds) => Math.max(seconds - 1, 0))
    }, 1000)

    const timeoutId = window.setTimeout(() => {
      const redirect = authPromptTarget.href
      setAuthPromptTarget(null)
      navigate({ to: '/sign-in', search: { redirect } })
    }, AUTH_PROMPT_SECONDS * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [authPromptTarget, navigate])

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptTarget(null)
    setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
  }, [])

  const navigateToSignIn = useCallback(() => {
    const redirect = authPromptTarget?.href || '/'
    setAuthPromptTarget(null)
    navigate({ to: '/sign-in', search: { redirect } })
  }, [authPromptTarget?.href, navigate])

  const handleNavLinkClick = useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      link: TopNavLink,
      closeMobile = false
    ) => {
      if (link.disabled) {
        event.preventDefault()
        return
      }

      if (link.requiresAuth) {
        event.preventDefault()
        if (closeMobile) {
          setMobileOpen(false)
        }
        setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
        setAuthPromptTarget({
          title: t(link.title),
          href: link.href,
        })
        return
      }

      if (closeMobile) {
        setMobileOpen(false)
      }
    },
    [t]
  )

  const navLinkClass = (isActive: boolean, disabled?: boolean) =>
    cn(
      isMarketing
        ? 'text-sm font-semibold whitespace-nowrap transition-colors duration-200'
        : 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200',
      isActive
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground',
      disabled && 'pointer-events-none opacity-50'
    )

  const landingIconSuffix = resolvedTheme === 'light' ? '-light' : ''
  const langIcon = isMarketing ? (
    <img
      src={`/landing/icon-lang${landingIconSuffix}.svg`}
      alt=''
      className={LANDING_ICON_IMG}
      aria-hidden
    />
  ) : undefined
  const themeIcon = isMarketing ? (
    <img
      src={`/landing/icon-theme${landingIconSuffix}.svg`}
      alt=''
      className={LANDING_ICON_IMG}
      aria-hidden
    />
  ) : undefined
  const bellIcon = isMarketing ? (
    <img
      src={`/landing/icon-bell${landingIconSuffix}.svg`}
      alt=''
      className={LANDING_ICON_IMG}
      aria-hidden
    />
  ) : undefined

  function renderDesktopAuthActions() {
    if (loading) {
      return <Skeleton className='h-8 w-24 rounded-full' />
    }
    if (isAuthenticated) {
      return <ProfileDropdown />
    }
    if (isAuth) {
      return <AuthEntryLinks pathname={pathname} />
    }
    return (
      <div className='flex items-center gap-1.5'>
        {showSignInButton && (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 rounded-full px-3.5 text-xs font-medium'
            render={<Link to='/sign-in' />}
          >
            {t('Sign in')}
          </Button>
        )}
        {pathname !== '/sign-up' && (
          <Button
            size='sm'
            className={cn(
              'h-8 rounded-full text-xs font-semibold',
              isLanding || pathname === '/'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 w-[120px] px-6'
                : 'px-4'
            )}
            render={<Link to='/sign-up' />}
          >
            {isLanding || pathname === '/' ? t('Sign up') : t('Get Started')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <header
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-50',
          className
        )}
      >
        <div
          className={cn(
            'pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            isMarketing
              ? 'max-w-[1200px] px-8 pt-0'
              : scrolled
                ? 'max-w-6xl px-3 pt-3'
                : 'max-w-7xl px-4 pt-0 md:px-6'
          )}
        >
          <nav
            className={cn(
              'relative flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
              isMarketing
                ? 'h-16'
                : scrolled
                  ? 'bg-background/60 ring-border/50 h-12 rounded-2xl pr-1.5 pl-4 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.02)] ring-[0.5px] backdrop-blur-2xl dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,0.4)]'
                  : 'h-16 px-2'
            )}
          >
            {/* Logo — customLogo may be a wide wordmark (e.g. landing UnionMeta) */}
            <Link
              to={homeUrl}
              className='group z-10 flex shrink-0 items-center gap-2.5'
            >
              {customLogo ? (
                <div
                  className={cn(
                    'flex items-center transition-all duration-300 group-hover:scale-105',
                    isMarketing ? 'h-8 w-[115px]' : 'h-8 max-w-[200px]'
                  )}
                >
                  {customLogo}
                </div>
              ) : (
                <div className='flex size-8 shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-105'>
                  {loading ? (
                    <Skeleton className='size-full rounded-lg' />
                  ) : (
                    <HeaderLogo
                      src={systemLogo}
                      loading={loading}
                      logoLoaded={logoLoaded}
                      className='size-full rounded-lg object-contain'
                    />
                  )}
                </div>
              )}
              {showSiteName ? (
                <span className='text-[15px] font-semibold tracking-tight'>
                  {loading ? <Skeleton className='h-4 w-16' /> : displaySiteName}
                </span>
              ) : null}
            </Link>

            {/* Centered desktop nav — Figma auth header has logo + opposite CTA only */}
            <div
              className={cn(
                'absolute left-1/2 hidden -translate-x-1/2 items-center lg:flex',
                isAuth && 'lg:hidden',
                isMarketing ? 'gap-7' : 'gap-0.5'
              )}
            >
              {links.map((link, i) => {
                const isActive = pathname === link.href
                if (link.external) {
                  return (
                    <a
                      key={i}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-disabled={link.disabled}
                      tabIndex={link.disabled ? -1 : undefined}
                      onClick={(event) => handleNavLinkClick(event, link)}
                      className={navLinkClass(false, link.disabled)}
                    >
                      {t(link.title)}
                    </a>
                  )
                }
                return (
                  <Link
                    key={i}
                    to={link.href}
                    disabled={link.disabled}
                    onClick={(event) => handleNavLinkClick(event, link)}
                    className={navLinkClass(isActive, link.disabled)}
                  >
                    {t(link.title)}
                  </Link>
                )
              })}
            </div>

            {/* Desktop actions */}
            <div
              className={cn(
                'hidden items-center lg:flex',
                isMarketing ? 'gap-4' : 'gap-0.5'
              )}
            >
              {!isMarketing &&
                (showLanguageSwitcher ||
                  showThemeSwitch ||
                  showNotifications) && (
                  <div className='bg-border/40 mx-1 hidden h-4 w-px lg:block' />
                )}

              {showLanguageSwitcher && (
                <LanguageSwitcher
                  triggerClassName={isMarketing ? LANDING_ICON_TRIGGER : undefined}
                  icon={langIcon}
                />
              )}
              {showThemeSwitch && (
                <ThemeSwitch
                  triggerClassName={isMarketing ? LANDING_ICON_TRIGGER : undefined}
                  icon={themeIcon}
                />
              )}
              {showNotifications && (
                <NotificationPopover
                  open={notifications.popoverOpen}
                  onOpenChange={notifications.setPopoverOpen}
                  unreadCount={notifications.unreadCount}
                  activeTab={notifications.activeTab}
                  onTabChange={notifications.setActiveTab}
                  notice={notifications.notice}
                  announcements={notifications.announcements}
                  loading={notifications.loading}
                  className={isMarketing ? LANDING_ICON_TRIGGER : undefined}
                  icon={bellIcon}
                />
              )}

              {showAuthButtons && (
                <>
                  {!isMarketing && (
                    <div className='bg-border/40 mx-1.5 h-4 w-px' />
                  )}
                  {renderDesktopAuthActions()}
                </>
              )}
            </div>

            {/* Mobile / tablet: compact actions + hamburger */}
            <div className='flex items-center gap-2 lg:hidden'>
              {showLanguageSwitcher && (
                <LanguageSwitcher
                  triggerClassName={isMarketing ? LANDING_ICON_TRIGGER : undefined}
                  icon={langIcon}
                />
              )}
              {showThemeSwitch && (
                <ThemeSwitch
                  triggerClassName={isMarketing ? LANDING_ICON_TRIGGER : undefined}
                  icon={themeIcon}
                />
              )}
              {showAuthButtons && !loading && isAuthenticated && (
                <ProfileDropdown />
              )}
              {showAuthButtons && !loading && !isAuthenticated && (
                isAuth ? (
                  <AuthEntryLinks pathname={pathname} compact />
                ) : (
                  <Button
                    size='sm'
                    className={cn(
                      'h-8 rounded-full text-xs font-semibold',
                      isLanding
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 px-6'
                        : 'px-3.5'
                    )}
                    render={<Link to='/sign-up' />}
                  >
                    {isLanding ? t('Sign up') : t('Get Started')}
                  </Button>
                )
              )}
              {!isAuth && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-9'
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={t('Toggle navigation menu')}
              >
                <div className='relative size-4'>
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] rotate-45' : 'top-[3px]'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'scale-x-0 opacity-0' : 'opacity-100'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] -rotate-45' : 'top-[11px]'
                    )}
                  />
                </div>
              </Button>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        className={cn(
          'bg-background/98 fixed inset-0 z-40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:pointer-events-none lg:hidden',
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      >
        <div className='flex h-full flex-col justify-between px-8 pt-20 pb-10'>
          <nav className='flex flex-col gap-1'>
            {links.map((link, i) => {
              const isActive = pathname === link.href
              const linkClassName = cn(
                'flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                mobileOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-4 opacity-0',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                link.disabled && 'pointer-events-none opacity-50'
              )
              const transitionStyle = {
                transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms',
              }
              if (link.external) {
                return (
                  <a
                    key={i}
                    href={link.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-disabled={link.disabled}
                    tabIndex={link.disabled ? -1 : undefined}
                    onClick={(event) => handleNavLinkClick(event, link, true)}
                    className={linkClassName}
                    style={transitionStyle}
                  >
                    {t(link.title)}
                  </a>
                )
              }
              return (
                <Link
                  key={i}
                  to={link.href}
                  disabled={link.disabled}
                  onClick={(event) => handleNavLinkClick(event, link, true)}
                  className={linkClassName}
                  style={transitionStyle}
                >
                  {t(link.title)}
                </Link>
              )
            })}
          </nav>

          <div
            className={cn(
              'flex flex-col gap-3 transition-all duration-500',
              mobileOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-4 opacity-0'
            )}
            style={{ transitionDelay: mobileOpen ? '250ms' : '0ms' }}
          >
            {showAuthButtons && (
              <>
                {isAuth && !isAuthenticated ? (
                  <AuthEntryLinks
                    pathname={pathname}
                    stacked
                    onNavigate={() => setMobileOpen(false)}
                  />
                ) : (
                  <>
                    {!isAuthenticated && showSignInButton && (
                      <Link
                        to='/sign-in'
                        onClick={() => setMobileOpen(false)}
                        className='border-border/50 text-foreground inline-flex h-11 items-center justify-center rounded-full border text-sm font-medium transition-opacity hover:opacity-90'
                      >
                        {t('Sign in')}
                      </Link>
                    )}
                    <Link
                      to={isAuthenticated ? '/dashboard' : '/sign-up'}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80',
                        isLanding
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-foreground text-background'
                      )}
                    >
                      {isAuthenticated
                        ? t('Go to Dashboard')
                        : isLanding
                          ? t('Sign up')
                          : t('Get Started')}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!authPromptTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeAuthPrompt()
          }
        }}
        title={t('Sign in required')}
        description={t('Please sign in to view {{module}}.', {
          module: authPromptTarget?.title || '',
        })}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        footer={
          <>
            <Button variant='outline' onClick={closeAuthPrompt}>
              {t('Cancel')}
            </Button>
            <Button onClick={navigateToSignIn}>{t('Sign in now')}</Button>
          </>
        }
      >
        <div className='bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
          {t('Redirecting to sign in in {{seconds}} seconds.', {
            seconds: authPromptSecondsLeft,
          })}
        </div>
      </Dialog>
    </>
  )
}
