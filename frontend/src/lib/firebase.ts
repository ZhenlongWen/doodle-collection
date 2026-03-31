import { FirebaseError, initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} from "firebase/storage";
import type { CollectionRecord, GalleryItem } from "./types";

function getFirebaseEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing Firebase environment variable: ${name}`);
  }

  return value;
}

const firebaseConfig = {
  apiKey: getFirebaseEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getFirebaseEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getFirebaseEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getFirebaseEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getFirebaseEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getFirebaseEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getFirebaseEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const db = getFirestore(app);
const storage = getStorage(app);

interface PersistCollectionInput {
  drawingImageDataUrl?: string;
  drawingImageUrl?: string;
  analysis: string;
  galleryItems: GalleryItem[];
}

function mapCollectionRecord(
  snapshot: QueryDocumentSnapshot,
): CollectionRecord {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    drawingImageUrl:
      typeof data.drawingImageUrl === "string" ? data.drawingImageUrl : "",
    analysis: typeof data.analysis === "string" ? data.analysis : "",
    galleryItems: Array.isArray(data.galleryItems)
      ? data.galleryItems as GalleryItem[]
      : [],
    createdAtMs: typeof data.createdAtMs === "number" ? data.createdAtMs : 0,
    authorUid: typeof data.authorUid === "string" ? data.authorUid : undefined,
  };
}

async function resolveDrawingImageUrl(
  uid: string,
  scope: "history" | "shared",
  input: PersistCollectionInput,
): Promise<string> {
  if (input.drawingImageUrl) {
    return input.drawingImageUrl;
  }

  if (!input.drawingImageDataUrl) {
    throw new Error("A drawing image is required before saving.");
  }

  const drawingRef = ref(
    storage,
    `drawings/${scope}/${uid}/${Date.now()}-${crypto.randomUUID()}.png`,
  );

  await uploadString(drawingRef, input.drawingImageDataUrl, "data_url");

  return getDownloadURL(drawingRef);
}

export async function ensureAnonymousUser(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "Unable to start an anonymous session.";
  }

  switch (error.code) {
    case "auth/operation-not-allowed":
      return "Anonymous Auth is disabled in Firebase Authentication. Enable the Anonymous provider in the Firebase console.";
    case "auth/admin-restricted-operation":
      return "This Firebase project is blocking anonymous sign-in. Check Authentication settings and provider permissions.";
    case "auth/network-request-failed":
      return "Firebase could not reach the auth service. Check your network and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Firebase Auth. Add your current domain in Firebase Authentication -> Settings -> Authorized domains.";
    default:
      return `${error.code}: ${error.message}`;
  }
}

export function subscribeSharedArchive(
  onData: (items: CollectionRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const archiveQuery = query(
    collection(db, "shared_archive"),
    orderBy("createdAtMs", "desc"),
    limit(48),
  );

  return onSnapshot(
    archiveQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapCollectionRecord));
    },
    (error) => onError?.(error),
  );
}

export function subscribeUserHistory(
  uid: string,
  onData: (items: CollectionRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const historyQuery = query(
    collection(db, "users", uid, "history"),
    orderBy("createdAtMs", "desc"),
    limit(48),
  );

  return onSnapshot(
    historyQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapCollectionRecord));
    },
    (error) => onError?.(error),
  );
}

export async function saveHistoryEntry(
  uid: string,
  input: PersistCollectionInput,
): Promise<CollectionRecord> {
  const drawingImageUrl = await resolveDrawingImageUrl(uid, "history", input);
  const createdAtMs = Date.now();

  const docRef = await addDoc(collection(db, "users", uid, "history"), {
    drawingImageUrl,
    analysis: input.analysis,
    galleryItems: input.galleryItems,
    createdAtMs,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    drawingImageUrl,
    analysis: input.analysis,
    galleryItems: input.galleryItems,
    createdAtMs,
  };
}

export async function addSharedArchiveEntry(
  uid: string,
  input: PersistCollectionInput,
): Promise<CollectionRecord> {
  const drawingImageUrl = await resolveDrawingImageUrl(uid, "shared", input);
  const createdAtMs = Date.now();

  const docRef = await addDoc(collection(db, "shared_archive"), {
    drawingImageUrl,
    analysis: input.analysis,
    galleryItems: input.galleryItems,
    createdAtMs,
    createdAt: serverTimestamp(),
    authorUid: uid,
  });

  return {
    id: docRef.id,
    drawingImageUrl,
    analysis: input.analysis,
    galleryItems: input.galleryItems,
    createdAtMs,
    authorUid: uid,
  };
}
