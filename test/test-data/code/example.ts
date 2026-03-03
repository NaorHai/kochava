// Example TypeScript file for testing
interface User {
  name: string;
  age: number;
}

function createUser(name: string, age: number): User {
  return { name, age };
}

export { User, createUser };
