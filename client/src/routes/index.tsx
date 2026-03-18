import { Navigate, createBrowserRouter, Outlet } from 'react-router-dom';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import {
  SiteLayout,
  SiteFAQPage,
  SiteHomePage,
  SiteAboutPage,
  SiteTermsPage,
  SiteContactPage,
  SitePrivacyPage,
  SiteNotFoundPage,
  SitePhilosophyPage,
  SiteTransparencyPage,
  SiteContentPolicyPage,
  SiteAcceptableUsePage,
} from '~/site/pages';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import Search from './Search';
import Root from './Root';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';
const MARKETING_HOSTS = new Set(['kyns.ai', 'www.kyns.ai']);
const currentHostname = window.location.hostname.toLowerCase();
const shouldServeMarketingSite = MARKETING_HOSTS.has(currentHostname);

export const router = createBrowserRouter(
  [
    ...(shouldServeMarketingSite
      ? [
          {
            path: '/',
            element: <SiteLayout />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                index: true,
                element: <SiteHomePage />,
              },
              {
                path: 'about',
                element: <SiteAboutPage />,
              },
              {
                path: 'philosophy',
                element: <SitePhilosophyPage />,
              },
              {
                path: 'transparency',
                element: <SiteTransparencyPage />,
              },
              {
                path: 'faq',
                element: <SiteFAQPage />,
              },
              {
                path: 'terms',
                element: <SiteTermsPage />,
              },
              {
                path: 'privacy',
                element: <SitePrivacyPage />,
              },
              {
                path: 'content-policy',
                element: <SiteContentPolicyPage />,
              },
              {
                path: 'acceptable-use',
                element: <SiteAcceptableUsePage />,
              },
              {
                path: 'contact',
                element: <SiteContactPage />,
              },
              {
                path: '*',
                element: <SiteNotFoundPage />,
              },
            ],
          },
        ]
      : []),
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          path: '/',
          element: <Root />,
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: <ChatRoute />,
            },
            {
              path: 'search',
              element: <Search />,
            },
            {
              path: 'agents',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
