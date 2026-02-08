export interface AgentResponse {
  answer: string;
}

export class AgentClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:3100') {
    this.baseUrl = baseUrl;
  }

  /**
   * Agent サーバーに質問を送信
   */
  async ask(question: string): Promise<string> {
    console.log(`[AgentClient] Asking: "${question}"`);

    const url = `${this.baseUrl}/ask`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`Agent server request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as AgentResponse;
    console.log(`[AgentClient] Answer: "${data.answer}"`);

    return data.answer;
  }

  /**
   * Agent サーバーの接続確認
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
