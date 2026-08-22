# Document Code Command

Use this command to audit and generate docstrings, PHPDoc/JSDoc type annotations, and inline documentation for complex functions or classes.

---

## Documentation Protocol

1. **Preserve Existing Comments**: Preserve all existing comments and docstrings that are unrelated to code modifications.
2. **Document Key Seams**:
   - Class purpose and domain responsibility.
   - Public method parameters, types, return types, and exceptions thrown.
   - Non-obvious algorithms, regex logic, or business constraints.
3. **Format Standards**:
   - JavaScript/TypeScript: JSDoc (`/** ... */`)
   - PHP: PHPDoc (`/** ... */`)
   - Python: Docstrings (`""" ... """`)
   - Go: Package and function comments (`// ...`)
