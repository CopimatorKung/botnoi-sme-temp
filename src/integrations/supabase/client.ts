// Supabase stub — no real backend connection
// All DB calls return empty data so the UI renders without env vars

const resolved = (data: any = null) => Promise.resolve({ data, error: null });

function makeQuery(): any {
  const self: any = {};
  const chain = () => self;
  const end = () => resolved(null);
  Object.assign(self, {
    select: chain, insert: chain, update: chain, delete: chain, upsert: chain,
    eq: chain, neq: chain, in: chain, not: chain, is: chain, like: chain,
    ilike: chain, or: chain, and: chain, order: chain, limit: chain,
    range: chain, filter: chain, match: chain, single: chain,
    maybeSingle: chain, throwOnError: chain, contains: chain,
    then: (resolve: any, reject?: any) => end().then(resolve, reject),
    catch: (reject: any) => end().catch(reject),
    finally: (cb: any) => end().finally(cb),
  });
  return self;
}

const mockChannel: any = {
  on: (_event: string, _filter: any, _cb?: any) => mockChannel,
  subscribe: (_cb?: any) => mockChannel,
  unsubscribe: () => Promise.resolve("ok"),
};

export const supabase: any = {
  from: (_table: string) => makeQuery(),
  channel: (_name: string) => mockChannel,
  removeChannel: (_ch: any) => Promise.resolve(),
  storage: {
    from: (_bucket: string) => ({
      upload: (_path: string, _file: any, _opts?: any) => resolved(null),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
    }),
  },
  functions: {
    invoke: (_fn: string, _opts?: any) => resolved(null),
  },
  auth: {
    signInWithOAuth: (_opts: any) => resolved(null),
    signInWithPassword: (_creds: any) => resolved({ session: null, user: null }),
    signUp: (_creds: any) => resolved({ session: null, user: null }),
    signOut: () => resolved(null),
    setSession: (_tokens: any) => resolved({ session: null, user: null }),
    getSession: () => resolved({ session: null }),
    onAuthStateChange: (_cb: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    resetPasswordForEmail: (_email: string, _opts?: any) => resolved(null),
    updateUser: (_attrs: any) => resolved({ user: null }),
  },
};
