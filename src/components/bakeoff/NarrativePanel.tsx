'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface NarrativePanelProps {
  narrativeShort: string;
  narrativeLong: string;
}

export function NarrativePanel({ narrativeShort, narrativeLong }: NarrativePanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <FileText className="text-crowe-indigo mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className="text-foreground leading-snug font-semibold">{narrativeShort}</p>

            {narrativeLong && (
              <>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-crowe-indigo hover:text-crowe-indigo-dark flex items-center gap-1 text-sm font-medium transition-colors"
                >
                  {expanded ? 'Hide Details' : 'Show Details'}
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {expanded && (
                  <div className="bg-muted/50 text-foreground rounded-lg p-4 text-sm leading-relaxed">
                    {narrativeLong.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('- ')) {
                        return (
                          <div key={i} className="mb-1 ml-4 flex gap-2">
                            <span className="text-crowe-amber-dark shrink-0">&bull;</span>
                            <span>{trimmed.slice(2)}</span>
                          </div>
                        );
                      }
                      if (trimmed === '') {
                        return <div key={i} className="h-2" />;
                      }
                      return (
                        <p key={i} className="mb-1">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
