
'use client';

import React, { useState, useEffect } from 'react';
import { LoginForm } from '@/components/login-form';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from 'firebase/auth';

interface SavedAccount {
  email: string;
  name: string;
  photoUrl?: string;
}

function AccountChooser({ accounts, onSelectAccount, onRemoveAccount, onUseAnotherAccount }: {
  accounts: SavedAccount[];
  onSelectAccount: (email: string) => void;
  onRemoveAccount: (email: string) => void;
  onUseAnotherAccount: () => void;
}) {
  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <Image
            src="https://i.postimg.cc/kGQrqkFv/login_performa.png"
            alt="Acceso PERFORMA"
            width={300}
            height={100}
          />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Inicios de sesión recientes</CardTitle>
        <CardDescription className="text-center">
          Haz clic en tu foto para iniciar sesión.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {accounts.map(account => (
          <div key={account.email} className="relative group">
            <button
              onClick={() => onSelectAccount(account.email)}
              className="flex items-center w-full p-3 space-x-4 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={account.photoUrl} />
                <AvatarFallback>{account.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="font-medium text-left">
                <div>{account.name}</div>
              </div>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAccount(account.email);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onUseAnotherAccount}>
          Ingresar con otra cuenta
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function Home() {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [view, setView] = useState<'chooser' | 'login'>('login');
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This code runs only on the client
    const storedAccounts = localStorage.getItem('savedUserAccounts');
    if (storedAccounts) {
      const accounts = JSON.parse(storedAccounts);
      if (accounts.length > 0) {
        setSavedAccounts(accounts);
        setView('chooser');
      }
    }

    // Force sign out if user lands here, to ensure a clean login flow.
    // This prevents being stuck in a logged-in state when visiting the root page.
    if (auth && auth.currentUser) {
        signOut(auth);
    }
  }, [auth]);

  const handleSelectAccount = (email: string) => {
    setSelectedAccountEmail(email);
    setView('login');
  };

  const handleUseAnotherAccount = () => {
    setSelectedAccountEmail(null);
    setView('login');
  }

  const handleRemoveAccount = (email: string) => {
    const updatedAccounts = savedAccounts.filter(acc => acc.email !== email);
    setSavedAccounts(updatedAccounts);
    localStorage.setItem('savedUserAccounts', JSON.stringify(updatedAccounts));
    if (updatedAccounts.length === 0) {
        setView('login');
    }
  };
  
  const handleLoginSuccess = (user: any, profile: any) => {
    const newAccount: SavedAccount = {
      email: user.email,
      name: profile.nombres + ' ' + profile.apellidos,
      photoUrl: profile.photoUrl,
    };
    
    // Add or update the account in localStorage
    const updatedAccounts = [
      newAccount,
      ...savedAccounts.filter(acc => acc.email !== newAccount.email)
    ].slice(0, 5); // Limit to 5 accounts

    setSavedAccounts(updatedAccounts);
    localStorage.setItem('savedUserAccounts', JSON.stringify(updatedAccounts));
    
    router.push('/dashboard');
  };

  if (view === 'chooser') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <AccountChooser
          accounts={savedAccounts}
          onSelectAccount={handleSelectAccount}
          onRemoveAccount={handleRemoveAccount}
          onUseAnotherAccount={handleUseAnotherAccount}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <LoginForm selectedAccountEmail={selectedAccountEmail} onLoginSuccess={handleLoginSuccess} />
    </main>
  );
}
