from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import iot_service

router = APIRouter(prefix="/api/iot", tags=["IoT Devices"])


class TelemetryIngestRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=255)
    payload: dict


@router.post("/telemetry")
def ingest_telemetry(
    body: TelemetryIngestRequest,
    request: Request,
    x_device_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not x_device_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="x-device-api-key header required")
    result = iot_service.ingest_telemetry(
        db=db,
        topic=body.topic,
        payload=body.payload,
        api_key=x_device_api_key,
        ip_address=request.client.host if request and request.client else None,
    )
    if not result["accepted"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result["reason"])
    return result
