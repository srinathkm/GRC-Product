import { createChatCompletion, isLlmConfigured } from './llm.js';

/**
 * Ask the LLM to produce a short "Failing areas and details" summary from Defender evidence
 * (score, band, findings). Used in the Data Security Compliance Summary section.
 * Returns plain text summary or null if LLM not configured or call fails.
 */
export async function generateDefenderSummary(opcoName, context) {
  if (!isLlmConfigured()) return null;
  const { score, band, evidence = {}, findings = [], reportType } = context;
  const findingsSnippet =
    findings.length > 0
      ? findings
          .slice(0, 20)
          .map((f) => `- [${f.severity || 'N/A'}] ${(f.title || '').slice(0, 120)}`)
          .join('\n')
      : 'No individual findings extracted.';
  const secureScore = evidence.secureScore ?? score ?? '—';
  const frameworkCoverage = evidence.frameworkCoverage ?? '—';
  const openCritical = evidence.openCritical ?? 0;
  const openHigh = evidence.openHigh ?? 0;

  const userContent = `
OpCo: ${opcoName}
Report type: ${reportType || 'Defender evidence'}
Security Posture Score: ${score ?? '—'} (Band: ${band ?? '—'})
Evidence: Framework coverage ${frameworkCoverage}%, Secure score ${secureScore}%. Open Critical: ${openCritical}, Open High: ${openHigh}.

Findings from uploaded evidence:
${findingsSnippet}

Based on the above, write a brief "Failing areas and details" summary (2–4 short paragraphs or bullet points) for the Data Security Compliance dashboard. Focus on: what is failing or at risk, which areas need improvement, and any critical or high-severity items. Use clear, professional language. If the score is high and there are no significant findings, note that the posture is largely compliant with minor improvement areas. Output only the summary text, no preamble or labels.
`.trim();

  try {
    const completion = await createChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a GRC analyst. You produce concise "Failing areas and details" summaries for security compliance dashboards based on Defender evidence (scores, bands, findings). Output only the summary text.',
        },
        { role: 'user', content: userContent },
      ],
      maxTokens: 600,
      responseFormat: 'text',
    });
    const text =
      completion?.choices?.[0]?.message?.content?.trim() ||
      completion?.choices?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error('Defender summary LLM error:', err.message);
    return null;
  }
}
