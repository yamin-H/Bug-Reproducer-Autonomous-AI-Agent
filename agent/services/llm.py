from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from typing import Type, TypeVar
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

T = TypeVar("T", bound=BaseModel)

def get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        timeout=30
    )

def ask_llm(prompt: str) -> str:
    llm = get_llm()
    response = llm.invoke([HumanMessage(content=prompt)])

    if isinstance(response.content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in response.content
        ).strip()

    return response.content.strip()

def ask_llm_structured(prompt: str, schema: Type[T]) -> T:
    llm = get_llm()
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke([HumanMessage(content=prompt)])