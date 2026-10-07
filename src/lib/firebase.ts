import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializa o App do Firebase
const app = initializeApp(firebaseConfig);

// Inicializa a Autenticação
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configura prompt para sempre permitir selecionar a conta Google
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Inicializa o Firestore com o Database ID provisionado
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validação da conexão com o Firestore na inicialização
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase em modo offline ou aguardando conexão.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Realiza o login real com o Google usando popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Salva ou atualiza perfil no Firestore
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        await setDoc(userDocRef, {
          id: user.uid,
          name: user.displayName || 'Usuário Google',
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'Designer & Desenvolvedor',
          avatarColor: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar perfil inicial no Firestore:', err);
    }

    return user;
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      console.log('Login popup fechado pelo usuário.');
      return null;
    }
    console.error('Erro ao autenticar com o Google:', error);
    throw error;
  }
}

/**
 * Login com Email e Senha
 */
export async function signInWithEmail(email: string, pass: string) {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

/**
 * Criação de conta com Email e Senha
 */
export async function signUpWithEmail(name: string, email: string, pass: string) {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const user = result.user;

  if (name) {
    try {
      await updateProfile(user, { displayName: name });
    } catch (e) {
      console.warn('Não foi possível atualizar displayName:', e);
    }
  }

  // Registra no Firestore
  try {
    await setDoc(doc(db, 'users', user.uid), {
      id: user.uid,
      name: name || user.displayName || 'Novo Usuário',
      email: user.email || email,
      photoURL: '',
      role: 'Membro',
      avatarColor: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Erro ao salvar documento do novo usuário no Firestore:', err);
  }

  return user;
}

/**
 * Envia e-mail de recuperação de senha pelo Firebase
 */
export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Confirma e salva a nova senha usando o código recebido pelo link do e-mail
 */
export async function confirmResetPassword(oobCode: string, newPass: string) {
  await confirmPasswordReset(auth, oobCode, newPass);
}

/**
 * Valida o código do link de redefinição de senha
 */
export async function verifyResetCode(oobCode: string) {
  return await verifyPasswordResetCode(auth, oobCode);
}

/**
 * Realiza o logout do usuário
 */
export async function logoutUser() {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { FirebaseUser };
