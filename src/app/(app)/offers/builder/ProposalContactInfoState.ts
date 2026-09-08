"use client";

import { useEffect, useState } from "react";
import {
  announceProposalBuilderStateChange,
  contactInfoStorageKey,
} from "./ProposalBuilderStorage";
import { useProposalBuilderStateSync } from "./useProposalBuilderStateSync";

export type OwnerContact = {
  id: string;
  crmContactId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ownershipPercentage: string;
};

export type PrimaryContactState = {
  sameAsOwner: boolean;
  ownerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
};

export type InvoicingRecipientSource = "primary-contact" | "business-owner" | "custom";

export type ContactInfoState = {
  companyName: string;
  invoicingEmail: string;
  invoicingRecipientSource: InvoicingRecipientSource;
  invoicingOwnerId: string;
  owners: OwnerContact[];
  primaryContact: PrimaryContactState;
};

export function createOwner(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  ownershipPercentage: string,
): OwnerContact {
  return {
    id,
    firstName,
    lastName,
    email,
    phone,
    ownershipPercentage,
  } satisfies OwnerContact;
}

export function formatPersonName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function formatEvenOwnershipShare(ownerCount: number) {
  if (ownerCount <= 0) return "";

  const share = 100 / ownerCount;
  return Number.isInteger(share) ? String(share) : share.toFixed(2);
}

export const INITIAL_CONTACT_INFO: ContactInfoState = {
  companyName: "",
  invoicingEmail: "",
  invoicingRecipientSource: "primary-contact",
  invoicingOwnerId: "owner-1",
  owners: [createOwner("owner-1", "", "", "", "", "100")],
  primaryContact: {
    sameAsOwner: true,
    ownerId: "owner-1",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
  },
};


function baseContactInfo(initialContactInfo?: Partial<ContactInfoState>): ContactInfoState {
  return {
    ...INITIAL_CONTACT_INFO,
    ...initialContactInfo,
    owners:
      initialContactInfo?.owners && initialContactInfo.owners.length > 0
        ? initialContactInfo.owners
        : INITIAL_CONTACT_INFO.owners,
    primaryContact: {
      ...INITIAL_CONTACT_INFO.primaryContact,
      ...initialContactInfo?.primaryContact,
    },
  };
}

export function mergeStoredContactInfo(raw: string, initialState: ContactInfoState): ContactInfoState {
  try {
    const parsed = JSON.parse(raw) as Partial<ContactInfoState>;
    return {
      ...initialState,
      ...parsed,
      owners: Array.isArray(parsed.owners) && parsed.owners.length > 0
        ? parsed.owners
        : initialState.owners,
      primaryContact: {
        ...initialState.primaryContact,
        ...parsed.primaryContact,
      },
    };
  } catch {
    return initialState;
  }
}

function readStoredContactInfo(
  storageKey: string,
  initialContactInfo?: Partial<ContactInfoState>,
  readStorage = true,
): ContactInfoState {
  const initialState = baseContactInfo(initialContactInfo);

  if (typeof window === "undefined" || !readStorage) {
    return initialState;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return initialState;
    return mergeStoredContactInfo(raw, initialState);
  } catch {
    return initialState;
  }
}

export function resolvePrimaryContact(contactInfo: ContactInfoState) {
  const selectedPrimaryOwner =
    contactInfo.owners.find((owner) => owner.id === contactInfo.primaryContact.ownerId) ?? null;

  return {
    firstName: contactInfo.primaryContact.sameAsOwner
      ? selectedPrimaryOwner?.firstName ?? ""
      : contactInfo.primaryContact.firstName,
    lastName: contactInfo.primaryContact.sameAsOwner
      ? selectedPrimaryOwner?.lastName ?? ""
      : contactInfo.primaryContact.lastName,
    email: contactInfo.primaryContact.sameAsOwner
      ? selectedPrimaryOwner?.email ?? ""
      : contactInfo.primaryContact.email,
    phone: contactInfo.primaryContact.sameAsOwner
      ? selectedPrimaryOwner?.phone ?? ""
      : contactInfo.primaryContact.phone,
  };
}

export function useProposalContactInfoDemoState({
  engagementId,
  initialContactInfo,
  persist = true,
  syncExternal = false,
}: {
  engagementId?: string;
  initialContactInfo?: Partial<ContactInfoState>;
  persist?: boolean;
  /**
   * Mirror edits made in another tab. Implies read-only: a mirror never writes
   * back, so two surfaces can never clobber each other or echo.
   */
  syncExternal?: boolean;
} = {}) {
  const storageKey = contactInfoStorageKey({ engagementId });
  // Initialize with SSR-safe defaults (no localStorage read) so server and client
  // agree on the first render. Then hydrate from localStorage in an effect below.
  // A mirror is strictly read-only. Enforcing it here rather than at the call
  // site means no caller can accidentally create a second writer for this key.
  const persistState = persist && !syncExternal;
  const [contactInfo, setContactInfo] = useState<ContactInfoState>(() =>
    readStoredContactInfo(storageKey, initialContactInfo, false),
  );
  const [hydratedFromStorage, setHydratedFromStorage] = useState(() => !persistState);

  useProposalBuilderStateSync({
    storageKey,
    enabled: syncExternal,
    onExternalValue: (raw) => {
      // A removed key means the draft was reset; fall back to defaults rather
      // than keep rendering a draft that no longer exists.
      setContactInfo(
        raw === null
          ? readStoredContactInfo(storageKey, initialContactInfo, false)
          : mergeStoredContactInfo(raw, baseContactInfo(initialContactInfo)),
      );
    },
  });

  useEffect(() => {
    if (!syncExternal) return;
    // A mirror still needs its own first read; it renders SSR-safe defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContactInfo(readStoredContactInfo(storageKey, initialContactInfo, true));
    // initialContactInfo is a fresh object each render, so it is excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, syncExternal]);

  useEffect(() => {
    if (!persistState) {
      return;
    }
    // Hydration is an intentional client-only state sync after SSR-safe markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContactInfo(readStoredContactInfo(storageKey, initialContactInfo, true));
    setHydratedFromStorage(true);
    // Only hydrate on mount / when the storage key changes. initialContactInfo is
    // an unstable object each render so intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, persistState]);

  useEffect(() => {
    if (!persistState || !hydratedFromStorage) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(contactInfo));
      announceProposalBuilderStateChange(storageKey);
    } catch {
      // Ignore localStorage failures in demo mode.
    }
  }, [contactInfo, hydratedFromStorage, persistState, storageKey]);

  function updateField<Key extends keyof ContactInfoState>(key: Key, value: ContactInfoState[Key]) {
    setContactInfo((current) => ({ ...current, [key]: value }));
  }

  function updateOwner(id: string, key: keyof Omit<OwnerContact, "id">, value: string) {
    setContactInfo((current) => ({
      ...current,
      owners: current.owners.map((owner) =>
        owner.id === id ? { ...owner, [key]: value } : owner,
      ),
    }));
  }

  function addOwner() {
    setContactInfo((current) => {
      const newOwners = [
        ...current.owners,
        createOwner(`owner-${Date.now()}`, "", "", "", "", ""),
      ];
      const evenShare = formatEvenOwnershipShare(newOwners.length);

      return {
        ...current,
        owners: newOwners.map((owner) => ({ ...owner, ownershipPercentage: evenShare })),
      };
    });
  }

  function removeOwner(id: string) {
    setContactInfo((current) => {
      const remainingOwners = current.owners.filter((owner) => owner.id !== id);
      const fallbackOwnerId = remainingOwners[0]?.id ?? "";
      // Mirror addOwner's even-split behavior so removing a member doesn't
      // leave the remaining owners' percentages summing to under 100%.
      const evenShare = formatEvenOwnershipShare(remainingOwners.length);

      return {
        ...current,
        owners: remainingOwners.map((owner) => ({ ...owner, ownershipPercentage: evenShare })),
        invoicingOwnerId:
          current.invoicingRecipientSource === "business-owner" &&
          current.invoicingOwnerId === id
            ? fallbackOwnerId
            : current.invoicingOwnerId,
        primaryContact:
          current.primaryContact.sameAsOwner && current.primaryContact.ownerId === id
            ? { ...current.primaryContact, ownerId: fallbackOwnerId }
            : current.primaryContact,
      };
    });
  }

  function updatePrimaryContact<Key extends keyof PrimaryContactState>(
    key: Key,
    value: PrimaryContactState[Key],
  ) {
    setContactInfo((current) => ({
      ...current,
      primaryContact: { ...current.primaryContact, [key]: value },
    }));
  }

  return {
    contactInfo,
    setContactInfo,
    updateField,
    updateOwner,
    addOwner,
    removeOwner,
    updatePrimaryContact,
  };
}
