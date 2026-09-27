import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { _test } from "../harness-api";
import { chunkDoc, bm25Top, buildDocContext } from "../src/lib/rag";

describe("Harness Backend & RAG Unit Tests", () => {
  describe("Redact helper", () => {
    it("redacts provider api keys", () => {
      const sensitive = "My key is sk-1234567890abcdef and xai-9876543210fedcba and AIzaSyD987654321 and sk-ant-api03-abcdefg";
      const redacted = _test.redact(sensitive);
      assert.doesNotMatch(redacted, /sk-1234567890/);
      assert.doesNotMatch(redacted, /xai-9876543210/);
      assert.doesNotMatch(redacted, /AIzaSyD987654321/);
      assert.doesNotMatch(redacted, /sk-ant-api03/);
      assert.match(redacted, /\[redacted\]/);
    });
  });

  describe("Message normalization", () => {
    it("normalizes and merges consecutive messages from the same role", () => {
      const msgs = [
        { role: "assistant", content: "ignore starting assistant" },
        { role: "user", content: "Hello" },
        { role: "user", content: "World" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "How are you?" }
      ];
      const normalized = _test.normalize(msgs);
      assert.equal(normalized.length, 3);
      assert.equal(normalized[0].role, "user");
      assert.equal(normalized[0].content, "Hello\n\nWorld");
      assert.equal(normalized[1].role, "assistant");
      assert.equal(normalized[2].role, "user");
      assert.equal(normalized[2].content, "How are you?");
    });

    it("throws if no valid user message", () => {
      assert.throws(() => _test.normalize([]), /Type a message first/);
      assert.throws(() => _test.normalize([{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }]), /The last message must be from you/);
    });
  });

  describe("Response Parsers", () => {
    it("parses OpenAI/xAI responses API payload", () => {
      const mockBody = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Here is the response.",
                annotations: [
                  { type: "url_citation", title: "Source 1", url: "https://example.com/1" }
                ]
              }
            ]
          }
        ],
        usage: { input_tokens: 15, output_tokens: 30 }
      };

      const result = _test.parseResponsesApi(mockBody);
      assert.equal(result.text, "Here is the response.");
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, "https://example.com/1");
      assert.equal(result.inTokens, 15);
      assert.equal(result.outTokens, 30);
    });

    it("parses Anthropic messages API payload", () => {
      const mockBody = {
        content: [
          {
            type: "text",
            text: "Claude response.",
            citations: [{ title: "Anthropic Citation", url: "https://anthropic.com/paper" }]
          }
        ],
        usage: { input_tokens: 25, output_tokens: 50 }
      };

      const result = _test.parseAnthropic(mockBody);
      assert.equal(result.text, "Claude response.");
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, "https://anthropic.com/paper");
      assert.equal(result.inTokens, 25);
      assert.equal(result.outTokens, 50);
    });

    it("parses Gemini generateContent payload", () => {
      const mockBody = {
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini answer." }]
            },
            groundingMetadata: {
              groundingChunks: [
                { web: { title: "Gemini Search", uri: "https://google.com/search" } }
              ]
            }
          }
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }
      };

      const result = _test.parseGemini(mockBody);
      assert.equal(result.text, "Gemini answer.");
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].url, "https://google.com/search");
      assert.equal(result.inTokens, 10);
      assert.equal(result.outTokens, 20);
    });
  });

  describe("RAG Document Chunking & BM25 Ranking", () => {
    it("chunks document with specified size and overlap", () => {
      const pageText = "word ".repeat(1000);
      const chunks = chunkDoc("report.pdf", [pageText], 1000, 200);
      assert.ok(chunks.length > 1);
      assert.equal(chunks[0].doc, "report.pdf");
      assert.equal(chunks[0].page, 1);
    });

    it("ranks chunks with BM25 based on query keywords", () => {
      const chunks = [
        { doc: "doc1.txt", page: 1, text: "The revenue grew by twenty percent in Q3." },
        { doc: "doc2.txt", page: 1, text: "The weather in Seattle was rainy and gloomy." },
        { doc: "doc3.txt", page: 1, text: "Quarterly revenue and profit margins exceeded target." }
      ];

      const ranked = bm25Top(chunks, "revenue profit quarterly", 2);
      assert.equal(ranked.length, 2);
      assert.equal(ranked[0].doc, "doc3.txt");
    });

    it("builds document context string with citations format", () => {
      const docs = [
        { name: "specs.pdf", pages: ["Architecture overview and API spec."] }
      ];
      const context = buildDocContext(docs, "architecture");
      assert.match(context, /=== DOCUMENTS ===/);
      assert.match(context, /\[specs\.pdf p\.1\]/);
      assert.match(context, /Architecture overview and API spec\./);
    });
  });
});
