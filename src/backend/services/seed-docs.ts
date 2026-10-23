import crypto from "node:crypto";
import type { DocumentRecord } from "../types";

export function buildStarterDocumentsForUser(uid: string): DocumentRecord[] {
  const now = new Date().toISOString();

  return [
    {
      id: `doc-os-${uid.slice(0, 8)}`,
      uid,
      title: "Operating Systems — Galvin Ch. 1–6",
      subject: "Operating Systems",
      fileName: "operating-systems-galvin.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2457600,
      sizeFormatted: "2.3 MB",
      storagePath: `users/${uid}/documents/operating-systems-galvin.pdf`,
      pageCount: 4,
      pages: [
        {
          pageNumber: 1,
          text: "Process Concepts & PCB: A process is a program in execution. Each process is represented in the operating system by a Process Control Block (PCB), which stores the process state (new, ready, running, waiting, terminated), program counter, CPU registers, CPU-scheduling information, memory-management information, and I/O status information. Context switching saves the state of the old process in its PCB and loads the saved state of the new process.",
        },
        {
          pageNumber: 2,
          text: "CPU Scheduling Algorithms: CPU scheduling selects a process from the ready queue to execute on the CPU. Scheduling criteria include CPU utilization, throughput, turnaround time, waiting time, and response time. First-Come, First-Served (FCFS) is non-preemptive and suffers from the convoy effect. Shortest-Job-First (SJF) gives the minimum average waiting time for a given set of processes, but can cause starvation for long processes if short processes keep arriving.",
        },
        {
          pageNumber: 3,
          text: "Round Robin & Priority Scheduling: Round Robin (RR) scheduling is designed for time-sharing systems. Each process gets a small unit of CPU time called a time quantum (usually 10 to 100 milliseconds). After the time quantum expires, the process is preempted and added to the end of the ready queue. If the time quantum is extremely large, Round Robin degenerates into FCFS. Priority scheduling assigns a priority to each process; starvation of low-priority processes is solved using aging (gradually increasing priority of waiting processes).",
        },
        {
          pageNumber: 4,
          text: "Deadlocks & Page Replacement: A deadlock situation can arise if and only if four necessary conditions hold simultaneously: (1) Mutual Exclusion, (2) Hold and Wait, (3) No Preemption, and (4) Circular Wait. Deadlocks can be avoided using the Banker's Algorithm. In virtual memory management, FIFO page replacement suffers from Belady's anomaly (more frames can cause more page faults), whereas LRU (Least Recently Used) and Optimal page replacement are stack algorithms and do not suffer from Belady's anomaly.",
        },
      ],
      status: "ready",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `doc-cn-${uid.slice(0, 8)}`,
      uid,
      title: "Computer Networks Unit 3 — Transport Layer",
      subject: "Computer Networks",
      fileName: "computer-networks-transport.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1572864,
      sizeFormatted: "1.5 MB",
      storagePath: `users/${uid}/documents/computer-networks-transport.pdf`,
      pageCount: 3,
      pages: [
        {
          pageNumber: 1,
          text: "Transport Layer Overview & UDP: The transport layer provides logical communication between application processes running on different hosts. User Datagram Protocol (UDP) is a connectionless, unreliable transport protocol with an 8-byte header (Source Port, Destination Port, Length, Checksum). UDP does not perform connection establishment, flow control, or congestion control, making it low-latency and suitable for DNS, VoIP, and live streaming.",
        },
        {
          pageNumber: 2,
          text: "Transmission Control Protocol (TCP): TCP is a connection-oriented, reliable byte-stream protocol with a minimum 20-byte header. TCP establishes connections using a Three-Way Handshake: (1) Client sends SYN with initial sequence number, (2) Server replies with SYN-ACK, and (3) Client sends ACK. TCP guarantees in-order delivery using sequence numbers, cumulative acknowledgments, and retransmissions.",
        },
        {
          pageNumber: 3,
          text: "TCP Flow Control & Congestion Control: Flow control prevents a fast sender from overwhelming a slow receiver's buffer using the Receive Window (rwnd). Congestion control prevents the sender from overloading the network infrastructure using the Congestion Window (cwnd) and four phases: Slow Start (exponential growth until ssthresh), Congestion Avoidance (linear additive increase), Fast Retransmit (on 3 duplicate ACKs), and Fast Recovery.",
        },
      ],
      status: "ready",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `doc-dbms-${uid.slice(0, 8)}`,
      uid,
      title: "DBMS Normalization & ACID Transactions",
      subject: "DBMS",
      fileName: "dbms-normalization.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1153433,
      sizeFormatted: "1.1 MB",
      storagePath: `users/${uid}/documents/dbms-normalization.pdf`,
      pageCount: 2,
      pages: [
        {
          pageNumber: 1,
          text: "Database Normalization: Normalization eliminates data redundancy and insertion, update, and deletion anomalies. First Normal Form (1NF) requires atomic attribute values. Second Normal Form (2NF) requires 1NF and no partial functional dependencies on a candidate key. Third Normal Form (3NF) requires 2NF and no transitive dependencies. Boyce-Codd Normal Form (BCNF) is a stricter form of 3NF where for every non-trivial functional dependency X -> Y, X must be a superkey.",
        },
        {
          pageNumber: 2,
          text: "ACID Transactions & Concurrency: A database transaction is a logical unit of work that must satisfy ACID properties: Atomicity (all-or-nothing execution via undo logging), Consistency (preserving integrity constraints), Isolation (concurrent execution equivalent to serial schedule via Two-Phase Locking or MVCC), and Durability (committed changes persist via write-ahead redo logging).",
        },
      ],
      status: "ready",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createSeedHistoryId(): string {
  return crypto.randomUUID();
}
