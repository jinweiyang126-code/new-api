/*
Copyright (C) 2023-2026 QuantumNous
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License version 3 or later.
*/
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthChrome } from '../lib/auth-chrome-context'
import { AuthBrand } from './auth-brand'
import { AuthCard } from './auth-card'
import { AuthEmailVerifyStep } from './auth-email-verify-step'
import { AuthSubmitButton } from './auth-submit-button'
import {
  AuthFieldLabel,
  AuthPasswordField,
  AuthTextField,
} from './auth-text-field'
import { OAuthProviders } from './oauth-providers'

export function AuthFlowPreview(props: { mode: 'sign-in' | 'sign-up' }) {
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form')
  const [code, setCode] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const signup = props.mode === 'sign-up'
  const { setAction } = useAuthChrome()

  useEffect(() => {
    if (step === 'verify') {
      setAction({ label: 'Back', onClick: () => setStep('form') })
    } else {
      setAction(null)
    }
    return () => setAction(null)
  }, [setAction, step])

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => seconds - 1),
      1000
    )
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  if (step === 'success') {
    return (
      <AuthCard className='flex flex-col items-center gap-6 text-center'>
        <AuthBrand />
        <span className='flex size-14 items-center justify-center rounded-full bg-[#7B50E3] text-white'>
          <Check />
        </span>
        <div>
          <h1 className='text-lg font-semibold'>
            {signup ? 'Account created' : 'Signed in successfully'}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            This is a UI preview. No account or session was created.
          </p>
        </div>
        <AuthSubmitButton onClick={() => setStep('form')}>
          Restart preview
        </AuthSubmitButton>
      </AuthCard>
    )
  }
  if (step === 'verify') {
    return (
      <AuthEmailVerifyStep
        email='preview@example.com'
        code={code}
        onCodeChange={setCode}
        onSubmit={() => setStep('success')}
        onResend={() => {
          setCode('')
          setResendSeconds(60)
        }}
        onEditEmail={() => setStep('form')}
        isSubmitting={false}
        isSending={false}
        secondsLeft={resendSeconds}
        isResendActive={resendSeconds > 0}
      />
    )
  }

  return (
    <AuthCard className='flex flex-col gap-6'>
      <div className='text-center'>
        <AuthBrand />
        <h1 className='mt-4 text-lg font-semibold'>
          {signup ? 'Sign Up Account' : 'Sign In'}
        </h1>
        {signup && (
          <p className='text-muted-foreground mt-2 text-xs'>
            Please enter your information to create account
          </p>
        )}
      </div>
      <OAuthProviders
        status={null}
        preview
        previewOnClick={() => setStep('success')}
        layout='icons'
      />
      <form
        className='flex flex-col gap-4'
        onSubmit={(e) => {
          e.preventDefault()
          setStep(signup ? 'verify' : 'success')
        }}
      >
        {signup && (
          <Field label='User name' type='text' placeholder='Enter user name' />
        )}
        <Field
          label={signup ? 'Email' : 'User name/Email'}
          type='email'
          placeholder={signup ? 'Enter email' : 'Enter your user name/Email'}
        />
        <Field label='Password' type='password' placeholder='Enter password' />
        {signup && (
          <Field
            label='Confirm password'
            type='password'
            placeholder='Confirm password'
          />
        )}
        <AuthSubmitButton type='submit'>Continue</AuthSubmitButton>
      </form>
      <p className='text-muted-foreground text-center text-xs'>
        Preview mode · no information is submitted
      </p>
    </AuthCard>
  )
}

function Field(props: { label: string; type: string; placeholder: string }) {
  return (
    <label className='flex flex-col gap-2'>
      <AuthFieldLabel label={props.label} />
      {props.type === 'password' ? (
        <AuthPasswordField required placeholder={props.placeholder} />
      ) : (
        <AuthTextField
          required
          type={props.type}
          placeholder={props.placeholder}
        />
      )}
    </label>
  )
}
