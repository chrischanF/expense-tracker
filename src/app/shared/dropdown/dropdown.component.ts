import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

export interface DropdownOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownComponent {
  private static nextId = 0;
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly listboxId = `app-dropdown-listbox-${DropdownComponent.nextId++}`;

  @Input({ required: true }) options: readonly DropdownOption[] = [];
  @Input() ariaLabel = '';
  @Input() compact = false;
  @Input() value = '';
  @Output() readonly valueChange = new EventEmitter<string>();

  @Input() disabled = false;
  isOpen = false;
  activeIndex = 0;

  get selectedOption(): DropdownOption | undefined {
    return this.options.find((option) => option.value === this.value);
  }

  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.activeIndex = Math.max(0, this.options.findIndex((option) => option.value === this.value));
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen) {
        this.isOpen = true;
        this.activeIndex = Math.max(0, this.options.findIndex((option) => option.value === this.value));
      } else if (this.options.length) {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex = (this.activeIndex + direction + this.options.length) % this.options.length;
      }
      return;
    }

    if (!this.isOpen) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.activeIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      this.activeIndex = this.options.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(this.options[this.activeIndex]);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      this.close();
    }
  }

  select(option: DropdownOption | undefined): void {
    if (!option) {
      return;
    }

    this.value = option.value;
    this.close();
    this.valueChange.emit(this.value);
  }

  @HostListener('document:click', ['$event'])
  closeWhenClickingOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private close(): void {
    this.isOpen = false;
  }
}