from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set

router = APIRouter(prefix="/shifts", tags=["HR / Gig Logistics"])

class Employee(BaseModel):
    id: str
    skills: List[str]
    max_weekly_hours: float = 40.0
    unavailable_windows: List[Dict[str, str]] = []

class SkillRequirement(BaseModel):
    skill: str
    count: int

class RequiredShift(BaseModel):
    id: str
    start: str
    end: str
    requirements: List[SkillRequirement]  # NEW: Multiple skill types per shift

class ShiftSolverRequest(BaseModel):
    employees: List[Employee]
    shifts: List[RequiredShift]
    min_rest_hours: float = 11.0

def check_constraints(employee: Employee, skill_needed: str, shift: RequiredShift, assigned_shifts: List[RequiredShift], min_rest: float) -> bool:
    shift_start = datetime.fromisoformat(shift.start)
    shift_end = datetime.fromisoformat(shift.end)
    shift_duration = (shift_end - shift_start).total_seconds() / 3600
    
    # 1. Skill Match
    if skill_needed not in employee.skills:
        return False
        
    # 2. Availability
    for window in employee.unavailable_windows:
        if not (shift_end <= datetime.fromisoformat(window["start"]) or shift_start >= datetime.fromisoformat(window["end"])):
            return False
            
    # 3. Hour Cap
    total_hours = sum([(datetime.fromisoformat(s.end) - datetime.fromisoformat(s.start)).total_seconds() / 3600 for s in assigned_shifts])
    if total_hours + shift_duration > employee.max_weekly_hours:
        return False
        
    # 4. Rest Period
    for existing in assigned_shifts:
        e_start = datetime.fromisoformat(existing.start)
        e_end = datetime.fromisoformat(existing.end)
        if not (shift_start >= e_end + timedelta(hours=min_rest) or shift_end <= e_start - timedelta(hours=min_rest)):
            return False
    return True

@router.post("")
async def solve_shifts(request: ShiftSolverRequest):
    # assignments: shift_id -> { skill: [emp_ids] }
    assignments: Dict[str, Dict[str, List[str]]] = {s.id: {req.skill: [] for req in s.requirements} for s in request.shifts}
    employee_schedules: Dict[str, List[RequiredShift]] = {e.id: [] for e in request.employees}
    
    # Sort shifts chronologically
    sorted_shifts = sorted(request.shifts, key=lambda x: x.start)
    
    # Flatten requirements for processing, but keep them tied to the shift
    unfillable = []
    
    # Track which employees are already "in the ward" for the current shift to avoid double-counting
    for shift in sorted_shifts:
        staff_currently_in_shift = set()
        
        for req in shift.requirements:
            needed = req.count
            for emp in request.employees:
                if len(assignments[shift.id][req.skill]) < needed:
                    # Ensure same person isn't assigned twice to the same shift under different skills
                    if emp.id not in staff_currently_in_shift:
                        if check_constraints(emp, req.skill, shift, employee_schedules[emp.id], request.min_rest_hours):
                            assignments[shift.id][req.skill].append(emp.id)
                            employee_schedules[emp.id].append(shift)
                            staff_currently_in_shift.add(emp.id)
            
            if len(assignments[shift.id][req.skill]) < needed:
                unfillable.append({
                    "shift_id": shift.id,
                    "skill": req.skill,
                    "missing": needed - len(assignments[shift.id][req.skill])
                })

    return {
        "status": "SUCCESS" if not unfillable else "UNDERSTAFFED",
        "team_assignments": assignments,
        "unfillable_report": unfillable,
        "utilization": {emp_id: len(sched) for emp_id, sched in employee_schedules.items()},
        "algorithm": "Heterogeneous Team Constraint Solver"
    }
