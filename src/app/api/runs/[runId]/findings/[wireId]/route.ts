import { NextRequest, NextResponse } from 'next/server';
import { getFindingByWireId, getRunById } from '@/lib/db/queries';
import { downloadDatasetFile } from '@/lib/blob/client';
import { parseFile } from '@/lib/schema/parsers';
import { createChildLogger } from '@/lib/logging/logger';

const log = createChildLogger('findings');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; wireId: string }> }
) {
  try {
    const { runId, wireId } = await params;

    const finding = await getFindingByWireId(runId, wireId);
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    // Fetch the original wire row data from the dataset
    const run = await getRunById(runId);
    let wireData: Record<string, string> | null = null;

    if (run?.blob_url) {
      try {
        const datasetBuffer = await downloadDatasetFile(run.blob_url);
        const parsed = parseFile(Buffer.from(datasetBuffer), run.source_format);

        // Find the row with the matching WireID
        wireData =
          parsed.rows.find((row) => {
            const rowWireId = row['WireID'] ?? row['wire_id'] ?? row['wireId'] ?? '';
            return rowWireId === wireId;
          }) ?? null;
      } catch {
        // Failed to fetch dataset, proceed without wire data
      }
    }

    return NextResponse.json({
      finding: {
        wireId: finding.wire_id,
        rank: finding.rank,
        score: finding.score,
        predictedLabel: finding.predicted_label,
        reasonCodes: finding.reason_codes_json,
        localExplainBlobUrl: finding.local_explain_blob_url,
      },
      wireData,
    });
  } catch (error) {
    log.error({ error }, 'Failed to get finding');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get finding' },
      { status: 500 }
    );
  }
}
