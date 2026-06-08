export class MovementResponseDto {
  id: string;
  documentId: string;
  movementDate: string;
  description: string;
  amount: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
