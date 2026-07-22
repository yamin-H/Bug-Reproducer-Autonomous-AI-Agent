"""LLM service — provides cached access to Groq via LangChain."""

from functools import lru_cache

from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    """Return a cached ChatGroq instance.

    Cached to avoid re-authenticating on every call.
    Timeout is generous (90s) to handle large prompts from big repos.
    """
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        timeout=90,
        max_retries=2,
    )


def ask_llm(prompt: str) -> str:
    """Send a prompt and return the text response."""
    llm = get_llm()
    response = llm.invoke([HumanMessage(content=prompt)])

    if isinstance(response.content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in response.content
        ).strip()

    return response.content.strip()


def ask_llm_structured(prompt: str, schema):
    """Send a prompt and return a structured (Pydantic) response.

    NOTE: Currently unused but kept for future use with structured outputs.
    """
    llm = get_llm()
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke([HumanMessage(content=prompt)])
