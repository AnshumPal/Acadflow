from ortools.sat.python import cp_model

# Create the model
model = cp_model.CpModel()

# Data
teachers = ["Alice", "Bob"]
classes = ["Math", "Science"]
slots = ["Morning", "Afternoon"]

# Variables: class -> teacher -> slot
assignments = {}
print("Step 1: Creating variables...")
for c in classes:
    for t in teachers:
        for s in slots:
            var_name = f"{c}_{t}_{s}"
            assignments[(c, t, s)] = model.NewBoolVar(var_name)
            print(f"  Created variable {var_name}")

# Constraint 1: Each class must be assigned exactly once
print("\nStep 2: Adding class assignment constraints...")
for c in classes:
    print(f"  Class {c} must be scheduled exactly once.")
    model.AddExactlyOne(assignments[(c, t, s)] for t in teachers for s in slots)

# Constraint 2: A teacher cannot teach two classes at the same time
print("\nStep 3: Adding teacher conflict constraints...")
for t in teachers:
    for s in slots:
        print(f"  Teacher {t} cannot teach two classes in {s}.")
        model.AddAtMostOne(assignments[(c, t, s)] for c in classes)

# Solve
print("\nStep 4: Solving the model...")
solver = cp_model.CpSolver()
status = solver.Solve(model)

# Print solution
print("\nStep 5: Extracting solution...")
if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    for c in classes:
        for t in teachers:
            for s in slots:
                if solver.Value(assignments[(c, t, s)]):
                    print(f"  -> {c} is taught by {t} in {s}")
else:
    print("No solution found.")
