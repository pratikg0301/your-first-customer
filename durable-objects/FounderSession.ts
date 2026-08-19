export type SessionStage =
  | 'intake'
  | 'enriching'
  | 'enriched'
  | 'icp_building'
  | 'icp_ready'
  | 'researching'
  | 'playbook_ready'
  | 'outbound_active'
  | 'closed';

export interface SessionState {
  founderId: string;
  stage: SessionStage;
  intake: Record<string, string>;
  enrichment: Record<string, unknown> | null;
  score: number | null;
  icp: Record<string, unknown> | null;
  playbook: Record<string, unknown> | null;
  targets: unknown[];
  lastUpdated: number;
}

export class FounderSession implements DurableObject {
  private state: DurableObjectState;
  private session: SessionState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async load(): Promise<SessionState> {
    if (!this.session) {
      this.session = (await this.state.storage.get<SessionState>('session')) ?? null;
    }
    return this.session!;
  }

  private async save(data: Partial<SessionState>): Promise<SessionState> {
    const current = await this.load().catch(() => null);
    this.session = { ...(current ?? {}), ...data, lastUpdated: Date.now() } as SessionState;
    await this.state.storage.put('session', this.session);
    return this.session;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    if (request.method === 'GET' && action === 'state') {
      const session = await this.load();
      return Response.json(session);
    }

    if (request.method === 'POST') {
      const body = await request.json<Partial<SessionState>>();

      if (action === 'init') {
        const session = await this.save({
          founderId: body.founderId!,
          stage: 'intake',
          intake: body.intake ?? {},
          enrichment: null,
          score: null,
          icp: null,
          playbook: null,
          targets: [],
        });
        return Response.json(session);
      }

      if (action === 'update') {
        const session = await this.save(body);
        return Response.json(session);
      }

      if (action === 'advance') {
        const current = await this.load();
        const stageOrder: SessionStage[] = [
          'intake', 'enriching', 'enriched', 'icp_building',
          'icp_ready', 'researching', 'playbook_ready', 'outbound_active', 'closed',
        ];
        const next = stageOrder[stageOrder.indexOf(current.stage) + 1] ?? current.stage;
        const session = await this.save({ ...body, stage: next });
        return Response.json(session);
      }
    }

    return new Response('Not found', { status: 404 });
  }
}
