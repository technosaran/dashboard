import { Page } from '@playwright/test';

export class GeminiAgent {
  private page: Page;
  private apiKey: string;
  private endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

  constructor(page: Page, apiKey: string) {
    this.page = page;
    this.apiKey = apiKey;
  }

  private async getInteractableElements() {
    return await this.page.evaluate(() => {
      // Find all buttons, inputs, selects, and links
      const interactables = document.querySelectorAll('button, input, select, a');
      const results: any[] = [];
      
      Array.from(interactables).forEach((el, index) => {
        // Only include visible elements (basic check)
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          el.setAttribute('data-ai-id', String(index));
          results.push({
            id: index,
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || undefined,
            name: (el as HTMLInputElement).name || undefined,
            placeholder: (el as HTMLInputElement).placeholder || undefined,
            text: el.textContent?.trim().substring(0, 50) || undefined
          });
        }
      });
      return results;
    });
  }

  public async execute(instruction: string, maxSteps = 5) {
    console.log(`\n🤖 Gemini Agent Executing: "${instruction}"`);
    
    for (let step = 0; step < maxSteps; step++) {
      // Wait a moment for UI to settle
      await this.page.waitForTimeout(1000);
      
      const elements = await this.getInteractableElements();
      
      const prompt = `
      You are an AI browser automation agent testing a web app.
      Instruction to fulfill: "${instruction}"
      
      Here are the currently visible interactive elements on the page:
      ${JSON.stringify(elements, null, 2)}
      
      Respond with ONLY a JSON object indicating your next action to fulfill the instruction.
      Formats allowed:
      1. {"action": "click", "id": 123}
      2. {"action": "fill", "id": 123, "value": "text to type"}
      3. {"action": "done"} (if the instruction has been completely fulfilled)
      
      Output ONLY valid JSON. No markdown backticks or explanations.
      `;

      try {
        const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean up markdown block if Gemini included it despite instructions
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const decision = JSON.parse(rawText);
        console.log(`   Step ${step + 1}: AI decided to ${decision.action} on ID ${decision.id || 'N/A'}`);

        if (decision.action === 'done') {
          console.log(`✅ AI successfully completed: "${instruction}"\n`);
          return;
        }

        if (decision.action === 'click' && decision.id !== undefined) {
          await this.page.click(`[data-ai-id="${decision.id}"]`);
        } else if (decision.action === 'fill' && decision.id !== undefined) {
          await this.page.fill(`[data-ai-id="${decision.id}"]`, decision.value);
        }

      } catch (err: any) {
        console.error(`   ❌ Agent encountered an error:`, err.message);
        break; // Stop execution on error
      }
    }
    
    console.log(`⚠️ Agent finished execution after hitting max steps or an error.\n`);
  }
}
