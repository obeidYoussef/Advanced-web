import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiRequest } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'
import { AuthContext } from './authContext.js'

const emptyProfileResult = {
  accessToken: null,
  user: null,
  error: '',
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [profileResult, setProfileResult] = useState(
    emptyProfileResult,
  )
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return
      }

      if (error) {
        setSessionError(error.message)
      }

      setSession(data.session)
      setSessionLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        void event

        if (!active) {
          return
        }

        setSession(nextSession)
        setSessionError('')

        if (!nextSession) {
          setProfileResult(emptyProfileResult)
        }
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const accessToken = session?.access_token

    if (!accessToken) {
      return undefined
    }

    let active = true

    apiRequest('/auth/me', { accessToken })
      .then((data) => {
        if (active) {
          setProfileResult({
            accessToken,
            user: data.user,
            error: '',
          })
        }
      })
      .catch((error) => {
        if (active) {
          setProfileResult({
            accessToken,
            user: null,
            error: error.message,
          })
        }
      })

    return () => {
      active = false
    }
  }, [session?.access_token, refreshVersion])

  const signUp = useCallback(
    async ({ fullName, email, password, accountType }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName,
            account_type: accountType,
          },
        },
      })

      if (error) {
        throw error
      }

      return data
    },
    [],
  )

  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      throw error
    }

    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }, [])

  const refreshUser = useCallback(() => {
    setRefreshVersion((current) => current + 1)
  }, [])

  const hasCurrentProfile =
    Boolean(session) &&
    profileResult.accessToken === session.access_token

  const user = hasCurrentProfile ? profileResult.user : null
  const authError =
    sessionError ||
    (hasCurrentProfile ? profileResult.error : '')
  const loading =
    sessionLoading || Boolean(session && !hasCurrentProfile)

  const value = useMemo(
    () => ({
      session,
      user,
      authError,
      loading,
      signUp,
      signIn,
      signOut,
      refreshUser,
    }),
    [
      session,
      user,
      authError,
      loading,
      signUp,
      signIn,
      signOut,
      refreshUser,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
