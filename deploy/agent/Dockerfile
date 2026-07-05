# Monitor agent image. Build from the REPO ROOT:
#   docker build -f deploy/agent/Dockerfile -t speednet-agent .
FROM python:3.12-slim
RUN pip install --no-cache-dir icmplib==3.0.4 httpx==0.27.2
WORKDIR /agent
COPY backend/scripts/monitor_agent.py .
CMD ["python", "monitor_agent.py"]
