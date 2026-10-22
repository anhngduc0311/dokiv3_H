'use client';

import { Suspense } from 'react';
import { AuthView } from '../../components/account/auth-view';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <AuthView isRegister={true} />
    </Suspense>
  );
}
