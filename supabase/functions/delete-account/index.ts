// POST (no body) → { deleted: true }. Permanently deletes the signed-in user's scans, profile and account.
import { withSupabase } from 'npm:@supabase/server@1.9.2';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 });

    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 });

    // Only ever the caller's own id, taken from their verified token.
    // Rows would also go with the user (on delete cascade); deleting them first makes that explicit.
    for (const table of ['scans', 'profiles'] as const) {
      const column = table === 'scans' ? 'user_id' : 'id';
      const { error } = await ctx.supabaseAdmin.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`delete ${table} failed`, error);
        return Response.json({ error: 'Could not delete account. Try again.' }, { status: 500 });
      }
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('delete user failed', error);
      return Response.json({ error: 'Could not delete account. Try again.' }, { status: 500 });
    }
    return Response.json({ deleted: true });
  }),
};
