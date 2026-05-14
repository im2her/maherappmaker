import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc, updateDoc, deleteDoc, addDoc, getDocs, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
  }
}

export async function safeAddDoc(collRef: any, data: any) {
  try {
    return await addDoc(collRef, data);
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      console.warn('Document already exists (likely due to offline retry). Proceeding safely.');
      return { id: 'ignored_due_to_already_exists_retry' };
    }
    throw error;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // DO NOT THROW HERE. This function is often called in async callbacks like onSnapshot
  // and throwing will unmount the entire React tree via ErrorBoundary.
  // Instead, you may want to show a toast or dispatch a custom event.
  const event = new CustomEvent('firestore-error', { detail: errInfo });
  window.dispatchEvent(event);
}
