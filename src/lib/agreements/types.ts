export type AgreementTemplateView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  content: string;
  status: "active" | "archived";
  isDefault: boolean;
  defaultForProductKind: string | null;
  updatedAt: string;
};

export type AgreementTemplateOption = Pick<
  AgreementTemplateView,
  "id" | "name" | "description" | "content" | "isDefault"
> & {
  defaultForProductKind?: string | null;
};
