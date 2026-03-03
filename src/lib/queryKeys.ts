export const queryKeys = {
    // All family-scoped data depends on familyId
    all: (familyId: string) => [familyId] as const,

    dashboard: (familyId: string, month: number, year: number) =>
        [familyId, "dashboard", month, year] as const,

    expenses: (familyId: string) => [familyId, "expenses"] as const,

    reports: (familyId: string, month: number, year: number) =>
        [familyId, "reports", month, year] as const,

    categories: (familyId: string) => [familyId, "categories"] as const,
};
