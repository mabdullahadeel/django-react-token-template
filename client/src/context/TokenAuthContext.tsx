import {
  FC,
  ReactNode,
  createContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import type { MeResponse, UserRegisterPaylod } from "../types/user.types";
import PropTypes from "prop-types";
import { authApi } from "../services/authApi";
import { resetSession, setSession, getSession } from "../utils/session";
import { useRouter } from "next/router";

interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: MeResponse | null;
}

interface AuthContextValue extends AuthState {
  method: "Token";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: UserRegisterPaylod) => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

type InitializeAction = {
  type: "INITIALIZE";
  payload: {
    isAuthenticated: boolean;
    user: MeResponse | null;
  };
};

type LoginAction = {
  type: "LOGIN";
  payload: {
    user: MeResponse;
  };
};

type LogoutAction = {
  type: "LOGOUT";
};

type RegisterAction = {
  type: "REGISTER";
  payload: {
    user: MeResponse;
  };
};

type Action = InitializeAction | LoginAction | LogoutAction | RegisterAction;

const initialAuthState: AuthState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null,
};

const handlers: Record<
  string,
  (state: AuthState, action: Action | any) => AuthState
> = {
  INITIALIZE: (state: AuthState, action: InitializeAction): AuthState => {
    const { isAuthenticated, user } = action.payload;

    return {
      ...state,
      isAuthenticated,
      isInitialized: true,
      user,
    };
  },
  LOGIN: (state: AuthState, action: LoginAction): AuthState => {
    const { user } = action.payload;

    return {
      ...state,
      isAuthenticated: true,
      user,
    };
  },
  LOGOUT: (state: AuthState): AuthState => ({
    ...state,
    isAuthenticated: false,
    user: null,
  }),
  REGISTER: (state: AuthState, action: RegisterAction): AuthState => {
    const { user } = action.payload;

    return {
      ...state,
      isAuthenticated: true,
      user,
    };
  },
};

const reducer = (state: AuthState, action: Action): AuthState =>
  handlers[action.type] ? handlers[action.type](state, action) : state;

export const AuthContext = createContext<AuthContextValue>({
  ...initialAuthState,
  method: "Token",
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  register: () => Promise.resolve(),
});

export const AuthProvider: FC<AuthProviderProps> = (props) => {
  const { children } = props;
  const [state, dispatch] = useReducer(reducer, initialAuthState);
  const router = useRouter();

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        const accessToken = getSession();
        if (accessToken) {
          setSession(accessToken);
          const { data: user } = await authApi.me();
          dispatch({
            type: "INITIALIZE",
            payload: {
              isAuthenticated: true,
              user,
            },
          });
        } else {
          dispatch({
            type: "INITIALIZE",
            payload: {
              isAuthenticated: false,
              user: null,
            },
          });
        }
      } catch (err) {
        console.error(err);
        dispatch({
          type: "INITIALIZE",
          payload: {
            isAuthenticated: false,
            user: null,
          },
        });
      }
    };

    initialize();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const { data } = await authApi.login({ username: email, password });
      setSession(data.token);
      const { data: user } = await authApi.me();

      dispatch({
        type: "LOGIN",
        payload: {
          user,
        },
      });
    } catch (error) {
      console.error(error);
      logout();
      throw new Error("Invalid credentials");
    }
  };

  const logout = async (): Promise<void> => {
    resetSession();
    dispatch({ type: "LOGOUT" });
    router.push("/auth/login");
  };

  const register = async (payload: UserRegisterPaylod): Promise<void> => {
    try {
      const { data: registerRes } = await authApi.register(payload);
      setSession(registerRes.token);
      const { data: user } = await authApi.me();

      dispatch({
        type: "REGISTER",
        payload: {
          user,
        },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        method: "Token",
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const AuthConsumer = AuthContext.Consumer;
